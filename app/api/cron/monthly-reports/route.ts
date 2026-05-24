import { NextResponse } from "next/server";
import { generateMonthlyReportForUser } from "@/lib/server-actions/monthly-report";
import { createServiceClient } from "@/lib/supabase/service";

// 前月の (year, month) を返す(UTC 基準)。
// Cron が走るのは毎月1日 00:00 UTC ≒ 09:00 JST、対象は「前月」
function previousMonth(now: Date): { year: number; month: number } {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
}

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { year, month } = previousMonth(new Date());

  // 全 profiles を取得
  const supabase = createServiceClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    user_id: string;
    status: string;
    detail?: string;
  }> = [];

  for (const p of profiles ?? []) {
    try {
      const r = await generateMonthlyReportForUser(p.id, year, month);
      if (r.status === "generated") {
        results.push({ user_id: p.id, status: "generated", detail: r.report_id });
      } else if (r.status === "skipped") {
        results.push({ user_id: p.id, status: "skipped", detail: r.reason });
      } else {
        results.push({ user_id: p.id, status: "error", detail: r.reason });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ user_id: p.id, status: "error", detail });
    }
  }

  return NextResponse.json({
    year,
    month,
    total: results.length,
    generated: results.filter((r) => r.status === "generated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    error: results.filter((r) => r.status === "error").length,
    results,
  });
}
