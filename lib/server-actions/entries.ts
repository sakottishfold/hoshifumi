"use server";

import { createClient } from "@/lib/supabase/server";
import { updateStreakForUser } from "@/lib/utils/streak";
import { todayJST, monthRange } from "@/lib/utils/date";
import { revalidatePath } from "next/cache";
import type { EntryWithAnswers } from "@/lib/types";

interface SubmitEntryInput {
  date?: string;
  bodySensation: number; // 1-5, Q1 body sensation tap (was `mood` pre-ADR-013)
  freeText: string;
  tomorrowMessage: string; // Q3 free text closure (was short_choice pre-ADR-014)
}

export async function submitEntry(input: SubmitEntryInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const entryDate = input.date ?? todayJST();

  // ADR-008 worldview: 未来日への書き込みは禁止(issue #001)。
  // 過去・今日は許可(retroactive journal 作成・編集の対応)。
  if (entryDate > todayJST()) {
    throw new Error("未来日は書けません");
  }

  // entry upsert
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: entryDate,
        template_name: "basic",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" },
    )
    .select()
    .single();

  if (entryError) throw entryError;
  if (!entry) throw new Error("Failed to create entry");

  // 既存の回答を削除して新規挿入(シンプル化)
  await supabase.from("answers").delete().eq("entry_id", entry.id);

  const answers = [
    { entry_id: entry.id, question_position: 1, value_number: input.bodySensation },
    { entry_id: entry.id, question_position: 2, value_text: input.freeText },
    // ADR-014: Q3 now stored in value_text (was value_choice when Q3 was short_choice in v0).
    { entry_id: entry.id, question_position: 3, value_text: input.tomorrowMessage },
  ];

  const { error: answersError } = await supabase.from("answers").insert(answers);
  if (answersError) throw answersError;

  // 連続記録を更新
  const streak = await updateStreakForUser(user.id);

  // 通算完了 entry 数を取得(milestone burst 判定用)
  const { count: totalEntries, error: countError } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("completed_at", "is", null);

  if (countError) throw countError;

  revalidatePath("/today");
  revalidatePath("/calendar");

  return {
    success: true,
    entryId: entry.id,
    streak,
    bodyPhase: input.bodySensation,
    totalEntries: totalEntries ?? 0,
  };
}

export async function getEntryByDate(
  date: string,
): Promise<EntryWithAnswers | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("entries")
    .select(`
      *,
      answers (*)
    `)
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .maybeSingle();

  if (error) throw error;
  return data as EntryWithAnswers | null;
}

export async function getEntriesForMonth(
  year: number,
  month: number,
): Promise<EntryWithAnswers[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { start, end } = monthRange(year, month);

  const { data, error } = await supabase
    .from("entries")
    .select(`
      *,
      answers (*)
    `)
    .eq("user_id", user.id)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true });

  if (error) throw error;
  return (data as EntryWithAnswers[]) ?? [];
}
