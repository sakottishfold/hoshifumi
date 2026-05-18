import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BloomMoon, type BloomBurst } from "@/components/BloomMoon";
import { CallbackCard } from "@/components/CallbackCard";
import { selectCallbackEntry } from "@/lib/server-actions/callback";
import { formatDisplay } from "@/lib/utils/date";
import { extractBodyPhase, extractFreeText } from "@/lib/utils/entry";

interface Props {
  searchParams: Promise<{ streak?: string; phase?: string; total?: string }>;
}

// milestone 初到達時のみ burst 発火(ADR-017 stage 同期 5/15/25/35 + 古典 100/365)
const BURST_BY_TOTAL: Record<number, Omit<BloomBurst, "seed">> = {
  5: { count: 3, tier: "small" },
  15: { count: 3, tier: "small" },
  25: { count: 3, tier: "small" },
  35: { count: 3, tier: "small" },
  100: { count: 5, tier: "medium" },
  365: { count: 7, tier: "large" },
};

function clampPhase(raw: string | undefined): 1 | 2 | 3 | 4 | 5 {
  const n = parseInt(raw ?? "5", 10);
  if (n >= 1 && n <= 5) return n as 1 | 2 | 3 | 4 | 5;
  return 5;
}

export default async function DonePage({ searchParams }: Props) {
  const params = await searchParams;
  const streak = parseInt(params.streak ?? "1", 10);
  const phase = clampPhase(params.phase);
  const total = parseInt(params.total ?? "0", 10);

  const burstConfig = BURST_BY_TOTAL[total];
  const burst: BloomBurst | undefined = burstConfig
    ? { ...burstConfig, seed: total }
    : undefined;

  const callback = await selectCallbackEntry();

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-12 max-w-md mx-auto">
        <div className="text-center space-y-8">
          <div className="mx-auto">
            <BloomMoon phase={phase} burst={burst} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900">
              今日もありがとう
            </h1>
            <p className="text-neutral-600">
              また明日、待ってます
            </p>
          </div>

          <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6">
            <p className="text-sm text-neutral-600">灯した夜</p>
            <p className="text-4xl font-bold text-primary-600 mt-1">
              {streak}
              <span className="text-lg ml-1 font-medium">つ</span>
            </p>
          </div>

          {callback && (
            <CallbackCard
              dateLabel={formatDisplay(callback.entry.entry_date)}
              bodyPhase={extractBodyPhase(callback.entry)}
              entryText={extractFreeText(callback.entry)}
              stageLabel={callback.label}
            />
          )}

          <Link
            href="/calendar"
            className="block w-full rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            これまでのほしふみを見る
          </Link>
        </div>
      </div>
    </main>
  );
}
