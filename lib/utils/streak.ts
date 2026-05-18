import { createClient } from "@/lib/supabase/server";
import { todayJST, parseDateJST } from "@/lib/utils/date";

/**
 * ユーザーの連続記録日数を再計算してprofileに更新する。
 * 当日エントリ完了時に呼び出す。
 *
 * 全日付計算は JST 基準(CLAUDE.md「Date is always JST」原則)。
 * 過去に `new Date()` + `setHours(0,0,0,0)` を使っていたが、Vercel UTC 上で
 * 「今日」が JST から 1 日ズレ → 今日の entry が streak にカウントされない bug。
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

  // 連続日数の計算(全部 JST)
  const todayDate = parseDateJST(todayJST());
  const DAY_MS = 24 * 60 * 60 * 1000;

  let currentStreak = 0;
  for (let i = 0; i < entries.length; i++) {
    const entryDate = parseDateJST(entries[i].entry_date);
    const dayDiff = Math.round(
      (todayDate.getTime() - entryDate.getTime()) / DAY_MS,
    );

    if (dayDiff === i) {
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
