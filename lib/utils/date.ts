import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const DEFAULT_TZ = "Asia/Tokyo";

/**
 * 現在のJST日付を 'YYYY-MM-DD' 形式で取得
 */
export function todayJST(): string {
  return formatInTimeZone(new Date(), DEFAULT_TZ, "yyyy-MM-dd");
}

/**
 * 'YYYY-MM-DD' を Date(JST) に変換
 */
export function parseDateJST(dateStr: string): Date {
  return toZonedTime(new Date(dateStr + "T00:00:00+09:00"), DEFAULT_TZ);
}

/**
 * 表示用フォーマット
 */
export function formatDisplay(dateStr: string): string {
  return formatInTimeZone(
    new Date(dateStr + "T00:00:00+09:00"),
    DEFAULT_TZ,
    "M月d日(E)",
  );
}

/**
 * 月の最初・最後の日付を取得 (YYYY-MM-DD)
 */
export function monthRange(year: number, month: number): {
  start: string;
  end: string;
} {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  // 次の月の0日 = 当月の末日
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/**
 * 月のカレンダーグリッド用に、月の全日を配列で返す
 */
export function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    days.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  return days;
}
