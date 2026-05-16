"use server";

import { createClient } from "@/lib/supabase/server";
import { todayJST } from "@/lib/utils/date";
import type { EntryWithAnswers } from "@/lib/types";

/**
 * Past-entry callback selection (ADR-017 γ-stage model).
 *
 * Surfaces one past entry on /today/done to create the "stars accumulating"
 * sensation (ADR-019 worldview). AI does not annotate — the entry is returned
 * verbatim per ADR-016 (引用係原則). The caller composes label + entry into
 * the CallbackCard.
 *
 * Stages unlock at entry-count milestones. Within unlocked stages, a cool-down
 * + probabilistic roll governs refire frequency so the surface stays scarce.
 *
 * See SPEC.md §8 + DECISIONS.md ADR-017.
 */

const STAGES = [
  { stage: 1, unlockAt: 5, range: [2, 4], label: "数日前のあなた" },
  { stage: 2, unlockAt: 15, range: [7, 10], label: "もう少し前のあなた" },
  { stage: 3, unlockAt: 25, range: [14, 20], label: "ひと月近く前のあなた" },
  { stage: 4, unlockAt: 35, range: [28, 35], label: "ひと月前のあなた" },
] as const;

type StageNumber = (typeof STAGES)[number]["stage"];

const COOLDOWN_DAYS = 3;
const REFIRE_PROBABILITY = 0.35;
const FETCH_LIMIT = 50; // covers the largest stage range (28–35) with margin.

export interface CallbackResult {
  entry: EntryWithAnswers;
  stage: StageNumber;
  label: string;
}

/**
 * Returns Q2 free-text (value_text) if it exists and is non-empty after trim.
 * "非空 Q2" gate per spec — entries without a usable Q2 are not callback candidates.
 */
function hasNonEmptyQ2(entry: EntryWithAnswers): boolean {
  const q2 = entry.answers.find((a) => a.question_position === 2);
  return !!q2 && !!q2.value_text && q2.value_text.trim().length > 0;
}

/**
 * Pick a random element. Returns null for empty arrays.
 */
function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function selectCallbackEntry(): Promise<CallbackResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Load profile callback state.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("last_callback_at, unlocked_stage")
    .eq("id", user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile) return null;

  const unlockedStage: number = profile.unlocked_stage ?? 0;
  const lastCallbackAt: string | null = profile.last_callback_at ?? null;

  // 2. Pull most recent completed entries (DESC). 50 covers Stage 4's 28–35
  //    window with headroom for the today-position-1 exclusion.
  const { data: rawEntries, error: entriesError } = await supabase
    .from("entries")
    .select(`*, answers (*)`)
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("entry_date", { ascending: false })
    .limit(FETCH_LIMIT);

  if (entriesError) throw entriesError;
  const entries = (rawEntries ?? []) as EntryWithAnswers[];

  // 3. Defensive position-1 exclusion. Spec says "position 1 = just-submitted
  //    today's entry"; if today's entry is at the head of the DESC list,
  //    drop it so range [a, b] aligns with "a days back" semantics for the
  //    user. We compare entry_date against today (JST) rather than relying on
  //    `completed_at` timing — if the user submitted today, today's entry is
  //    by definition at index 0 of the DESC list, so this is robust for the
  //    Stage 1 first-fire case where entryCount === 5 means "just submitted
  //    the 5th entry".
  const today = todayJST();
  const candidatesPool: EntryWithAnswers[] =
    entries[0]?.entry_date === today ? entries.slice(1) : entries;

  // entryCount counts ALL completed entries the user has (including today),
  // since unlock thresholds are stated in terms of "the Nth entry".
  const entryCount = entries.length;
  if (entryCount < STAGES[0].unlockAt) return null;

  /**
   * Extract entries inside a [a, b] range. After today-exclusion, candidatesPool
   * index 0 corresponds to "position 2" (one day's worth back from today's
   * just-submitted entry). So position p → candidatesPool[p - 2].
   *
   * Indexes past the array end are silently dropped (per spec).
   */
  const sliceRange = (a: number, b: number): EntryWithAnswers[] => {
    const start = Math.max(0, a - 2);
    const end = Math.min(candidatesPool.length, b - 1); // inclusive b → exclusive end = (b - 2) + 1
    if (start >= end) return [];
    return candidatesPool.slice(start, end);
  };

  // 4. Deterministic unlock fire — fires exactly when entryCount hits a stage's
  //    unlockAt for the first time. Stage 1 (5th entry) is the onboarding hook
  //    per SPEC §8.
  const unlockingStage = STAGES.find(
    (s) => entryCount === s.unlockAt && s.stage > unlockedStage,
  );

  if (unlockingStage) {
    const rangeCandidates = sliceRange(
      unlockingStage.range[0],
      unlockingStage.range[1],
    ).filter(hasNonEmptyQ2);

    const chosen = pickRandom(rangeCandidates);
    if (!chosen) {
      // Edge case: user hit the milestone but has no eligible (non-empty Q2)
      // entry inside that stage's range. Don't bump unlocked_stage so the
      // unlock can fire on a future day if back-fill happens; just no callback
      // today. last_callback_at stays untouched.
      return null;
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        unlocked_stage: unlockingStage.stage,
        last_callback_at: nowIso,
      })
      .eq("id", user.id);
    if (updateError) throw updateError;

    return {
      entry: chosen,
      stage: unlockingStage.stage,
      label: unlockingStage.label,
    };
  }

  // 5. Probabilistic refire path — only if at least Stage 1 is unlocked.
  if (unlockedStage < 1) return null;

  // Cool-down gate.
  if (lastCallbackAt) {
    const last = new Date(lastCallbackAt).getTime();
    const elapsedMs = Date.now() - last;
    const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (elapsedMs < cooldownMs) return null;
  }

  // Probability roll.
  if (Math.random() >= REFIRE_PROBABILITY) return null;

  // Union of all unlocked stages' ranges (deduped by entry id).
  const seen = new Set<string>();
  const pooled: EntryWithAnswers[] = [];
  for (const s of STAGES) {
    if (s.stage > unlockedStage) break;
    for (const e of sliceRange(s.range[0], s.range[1])) {
      if (!seen.has(e.id) && hasNonEmptyQ2(e)) {
        seen.add(e.id);
        pooled.push(e);
      }
    }
  }

  const chosen = pickRandom(pooled);
  if (!chosen) {
    // No eligible candidate — don't burn the cool-down; the user retries
    // naturally tomorrow.
    return null;
  }

  // Locate which stage's range contains the chosen entry so we can attach the
  // right label. Iterate in unlock order; first containing stage wins.
  const chosenIndexInPool = candidatesPool.findIndex(
    (e) => e.id === chosen.id,
  );
  const positionFromToday = chosenIndexInPool + 2; // pool[0] === position 2

  let resolvedStage: (typeof STAGES)[number] = STAGES[0];
  for (const s of STAGES) {
    if (s.stage > unlockedStage) break;
    if (
      positionFromToday >= s.range[0] &&
      positionFromToday <= s.range[1]
    ) {
      resolvedStage = s;
      break;
    }
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ last_callback_at: nowIso })
    .eq("id", user.id);
  if (updateError) throw updateError;

  return {
    entry: chosen,
    stage: resolvedStage.stage,
    label: resolvedStage.label,
  };
}
