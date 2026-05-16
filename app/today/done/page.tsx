import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { MoonPhase } from "@/components/MoonPhase";

interface Props {
  searchParams: Promise<{ streak?: string }>;
}

export default async function DonePage({ searchParams }: Props) {
  const params = await searchParams;
  const streak = parseInt(params.streak ?? "1", 10);

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-12 max-w-md mx-auto">
        <div className="text-center space-y-8">
          <div className="mx-auto w-20 h-20">
            <MoonPhase phase={5} />
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
