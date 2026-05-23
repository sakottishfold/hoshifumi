"use server";

import { createClient } from "@/lib/supabase/server";
import { updateStreakForUser } from "@/lib/utils/streak";
import { todayJST, monthRange } from "@/lib/utils/date";
import { revalidatePath } from "next/cache";
import type { EntryWithAnswers, FollowUpTurn } from "@/lib/types";

interface SubmitEntryInput {
  date?: string;
  /** 追加テンプレート: 使用したテンプレ。未指定は "basic" */
  templateName?: string;
  bodySensation: number; // 1-5, Q1 body sensation tap (was `mood` pre-ADR-013)
  freeText: string;
  // ADR-023: Q3 は chip(value_choice 行き)or text(value_text 行き)排他。
  /** Q3 chip 選択(chip mode 時)*/
  tomorrowChip?: string;
  /** Q3 自由記述(text escape mode 時)*/
  tomorrowMessage?: string;
  /** ADR-024 AI follow-up 対話(0件 = silent skip、最大3件)*/
  aiTurns?: FollowUpTurn[];
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
        template_name: input.templateName ?? "basic",
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

  const answers: Array<{
    entry_id: string;
    question_position: number;
    value_number?: number;
    value_text?: string;
    value_choice?: string;
    question_text?: string;
  }> = [
    { entry_id: entry.id, question_position: 1, value_number: input.bodySensation },
    { entry_id: entry.id, question_position: 2, value_text: input.freeText },
  ];

  // ADR-023: Q3 は chip(value_choice)or text(value_text)排他。
  // chip 優先(両方渡された場合 chip)、両方 undefined なら Q3 行を insert しない。
  if (input.tomorrowChip) {
    answers.push({
      entry_id: entry.id,
      question_position: 3,
      value_choice: input.tomorrowChip,
    });
  } else if (input.tomorrowMessage) {
    answers.push({
      entry_id: entry.id,
      question_position: 3,
      value_text: input.tomorrowMessage,
    });
  }

  // ADR-024: AI follow-up 対話を pos 4..6 に保存(silent skip 時は空配列 → insert なし)
  (input.aiTurns ?? []).forEach((turn, i) => {
    answers.push({
      entry_id: entry.id,
      question_position: 4 + i,
      question_text: turn.question,
      value_text: turn.answer,
    });
  });

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
