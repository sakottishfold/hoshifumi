import { getEntriesForMonth } from "@/lib/server-actions/entries";
import { CalendarGrid } from "./_components/CalendarGrid";
import { AppHeader } from "@/components/AppHeader";

interface Props {
  searchParams: Promise<{ y?: string; m?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = new Date();
  const year = params.y ? parseInt(params.y, 10) : today.getFullYear();
  const month = params.m ? parseInt(params.m, 10) : today.getMonth() + 1;

  const entries = await getEntriesForMonth(year, month);

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-6 max-w-md mx-auto">
        <CalendarGrid year={year} month={month} entries={entries} />

        <div className="mt-8 space-y-2">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            この月のサマリ
          </p>
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
            <p className="text-sm text-neutral-600">
              入力した日数:{" "}
              <span className="font-bold text-neutral-900">
                {entries.length}
              </span>
              日
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
