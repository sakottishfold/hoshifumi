"use server";

// ADR-016 準拠の月次レポート生成 Server Action。
// 1. 指定ユーザー × 指定月のエントリを取得
// 2. < 5 件なら skip(信号不足)
// 3. deterministic 計算(entry_count / body_phase_distribution / word_frequencies)
// 4. AI 呼び出し(Anthropic Sonnet 4.6 + responseSchema)
// 5. 検証(verbatim 部分文字列チェック + entry_id 所有者チェック + 件数クランプ)
// 6. monthly_reports に upsert(overwrite 冪等)

import { chat } from "@/lib/ai";
import {
  MONTHLY_REPORT_SYSTEM_PROMPT,
  MONTHLY_REPORT_RESPONSE_SCHEMA,
  buildMonthlyReportMessages,
  type MonthlyReportAIOutput,
  type MonthlyReportInputEntry,
} from "@/lib/ai/prompts/monthly-report";
import { createServiceClient } from "@/lib/supabase/service";
import { BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { wordFrequencies } from "@/lib/utils/text";

const MIN_ENTRIES = 5;
const MAX_TOP_PHRASES = 8;
const MAX_HIGHLIGHTS = 5;
const MAX_DAY_PAIRS = 2;
const AI_MODEL = "claude-sonnet-4-6"; // ADR-022 同様 Anthropic、ここでは Sonnet
const AI_TIMEOUT_MS = 30_000; // 月次は monthly = 1 ユーザー 1 回、余裕を持たせる
const AI_MAX_OUTPUT_TOKENS = 2000;

export type MonthlyReportStatus =
  | { status: "generated"; report_id: string }
  | { status: "skipped"; reason: "insufficient_entries" | "ai_failed" }
  | { status: "error"; reason: string };

/** 指定ユーザー × 指定月のレポートを生成して monthly_reports に upsert する。 */
export async function generateMonthlyReportForUser(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlyReportStatus> {
  const supabase = createServiceClient();

  // 1. 当該月のエントリ + answers を取得
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = monthEndDate(year, month);
  const { data: entriesData, error: entriesError } = await supabase
    .from("entries")
    .select(`id, entry_date, completed_at, answers (question_position, value_number, value_text, value_choice, question_text)`)
    .eq("user_id", userId)
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .not("completed_at", "is", null);
  if (entriesError) return { status: "error", reason: entriesError.message };

  const entries = (entriesData ?? []) as Array<{
    id: string;
    entry_date: string;
    completed_at: string | null;
    answers: Array<{
      question_position: number;
      value_number: number | null;
      value_text: string | null;
      value_choice: string | null;
      question_text: string | null;
    }>;
  }>;

  // 2. 5 件未満なら skip
  if (entries.length < MIN_ENTRIES) {
    return { status: "skipped", reason: "insufficient_entries" };
  }

  // 3. deterministic:entry_count / body_phase_distribution / word_frequencies
  const entry_count = entries.length;
  const body_phase_distribution: Record<string, number> = {};
  const freeTexts: string[] = [];
  // AI 入力用にもパース
  const aiInput: MonthlyReportInputEntry[] = [];
  // 検証用に entry_id → 本文 concat map
  const bodyByEntryId = new Map<string, string>();

  for (const e of entries) {
    const bodyAnswer = e.answers.find((a) => a.question_position === 1);
    const q2Answer = e.answers.find((a) => a.question_position === 2);
    const q3Answer = e.answers.find((a) => a.question_position === 3);
    const aiAnswers = e.answers
      .filter((a) => a.question_position >= 4)
      .sort((a, b) => a.question_position - b.question_position);

    const phase = bodyAnswer?.value_number ?? null;
    if (phase !== null) {
      const key = String(phase);
      body_phase_distribution[key] = (body_phase_distribution[key] ?? 0) + 1;
    }
    const bodyLabel = BODY_SENSATION_OPTIONS.find((o) => o.value === phase)?.label ?? "";

    const q2 = q2Answer?.value_text ?? "";
    const q3FreeText = q3Answer?.value_text ?? "";
    const q3Chip = q3Answer?.value_choice ?? "";
    const aiDialog = aiAnswers.map((a) => ({
      q: a.question_text ?? "",
      a: a.value_text ?? "",
    }));

    // word frequency 用テキスト:Q2 / Q3 free_text / AI 対話の user 回答(chip 選択値は含めない)
    if (q2) freeTexts.push(q2);
    if (q3FreeText) freeTexts.push(q3FreeText);
    for (const t of aiDialog) {
      if (t.a) freeTexts.push(t.a);
    }

    // 検証用本文 concat
    const bodyParts: string[] = [];
    if (q2) bodyParts.push(q2);
    if (q3FreeText) bodyParts.push(q3FreeText);
    for (const t of aiDialog) {
      if (t.a) bodyParts.push(t.a);
    }
    bodyByEntryId.set(e.id, bodyParts.join("\n"));

    aiInput.push({
      entry_id: e.id,
      date: e.entry_date,
      body_phase: phase ?? 0,
      body_label: bodyLabel,
      q2,
      q3: q3Chip || q3FreeText,
      ai_dialog: aiDialog,
    });
  }

  const word_frequencies = wordFrequencies(freeTexts, 15);

  // 4. AI 呼び出し
  let aiOutput: MonthlyReportAIOutput;
  try {
    const response = await chat({
      system: MONTHLY_REPORT_SYSTEM_PROMPT,
      messages: buildMonthlyReportMessages(aiInput),
      temperature: 0.4,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      timeoutMs: AI_TIMEOUT_MS,
      responseSchema: MONTHLY_REPORT_RESPONSE_SCHEMA,
      model: AI_MODEL,
    });
    aiOutput = JSON.parse(response.text) as MonthlyReportAIOutput;
  } catch (err) {
    void err;
    return { status: "skipped", reason: "ai_failed" };
  }

  // 5. 検証 + クランプ
  const validIds = new Set(entries.map((e) => e.id));

  // top_phrases:entry_id が valid + phrase が source 本文の部分文字列
  const top_phrases = (Array.isArray(aiOutput.top_phrases) ? aiOutput.top_phrases : [])
    .filter((p) => {
      if (!p || typeof p.entry_id !== "string" || typeof p.phrase !== "string") return false;
      if (!validIds.has(p.entry_id)) return false;
      const body = bodyByEntryId.get(p.entry_id);
      return body !== undefined && body.includes(p.phrase);
    })
    .slice(0, MAX_TOP_PHRASES);

  // highlight_entry_ids:valid な entry_id のみ、重複除去
  const highlight_entry_ids = Array.from(
    new Set(
      (Array.isArray(aiOutput.highlight_entry_ids) ? aiOutput.highlight_entry_ids : [])
        .filter((id) => typeof id === "string" && validIds.has(id)),
    ),
  ).slice(0, MAX_HIGHLIGHTS);

  // day_pairs:2 要素のペアで、両方 valid + 異なる entry_id
  const day_pairs = (Array.isArray(aiOutput.day_pairs) ? aiOutput.day_pairs : [])
    .filter(
      (pair): pair is [string, string] =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "string" &&
        pair[0] !== pair[1] &&
        validIds.has(pair[0]) &&
        validIds.has(pair[1]),
    )
    .slice(0, MAX_DAY_PAIRS);

  // 6. upsert
  const { data: upserted, error: upsertError } = await supabase
    .from("monthly_reports")
    .upsert(
      {
        user_id: userId,
        year,
        month,
        entry_count,
        body_phase_distribution,
        word_frequencies,
        highlight_entry_ids,
        top_phrases,
        day_pairs,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,month" },
    )
    .select("id")
    .single();
  if (upsertError) return { status: "error", reason: upsertError.message };
  if (!upserted) return { status: "error", reason: "upsert returned no row" };

  return { status: "generated", report_id: upserted.id };
}

/** YYYY-MM-DD 形式で当該年月の末日を返す(うるう年対応)。 */
function monthEndDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
