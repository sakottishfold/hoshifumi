import { createClient } from "@/lib/supabase/server";

/**
 * ユーザーの連続記録日数を再計算してprofileに更新する。
 * 当日エントリ完了時に呼び出す。
 */
export async function updateStreakForUser(userId: string): Promise<{
  streak_days: number;
  longest_streak: number;
}> {
  const supabase = await createClient();

  // 直近の全エントリを取得 (新しい順)
  const { data: entries } = await supabase
    .from("entries")
    .select("entry_date, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("entry_date", { ascending: false })
    .limit(365);

  if (!entries || entries.length === 0) {
    await supabase
      .from("profiles")
      .update({ streak_days: 0 })
      .eq("id", userId);
    return { streak_days: 0, longest_streak: 0 };
  }

  // 連続日数の計算
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < entries.length; i++) {
    const entryDate = new Date(entries[i].entry_date + "T00:00:00+09:00");
    entryDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    expectedDate.setHours(0, 0, 0, 0);

    if (entryDate.getTime() === expectedDate.getTime()) {
      currentStreak++;
    } else {
      break;
    }
  }

  // 最長記録の取得・更新
  const { data: profile } = await supabase
    .from("profiles")
    .select("longest_streak")
    .eq("id", userId)
    .single();

  const longestStreak = Math.max(profile?.longest_streak ?? 0, currentStreak);

  await supabase
    .from("profiles")
    .update({
      streak_days: currentStreak,
      longest_streak: longestStreak,
      last_entry_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return { streak_days: currentStreak, longest_streak: longestStreak };
}
