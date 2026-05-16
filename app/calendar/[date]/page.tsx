import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Edit2 } from "lucide-react";
import { getEntryByDate } from "@/lib/server-actions/entries";
import { formatDisplay, todayJST } from "@/lib/utils/date";
import { BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { AppHeader } from "@/components/AppHeader";
import { MoonPhase } from "@/components/MoonPhase";

interface Props {
  params: Promise<{ date: string }>;
}

export default async function EntryDetailPage({ params }: Props) {
  const { date } = await params;

  // 簡易バリデーション (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const entry = await getEntryByDate(date);
  const isToday = date === todayJST();

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-6 max-w-md mx-auto">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          カレンダーへ戻る
        </Link>

        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-neutral-900">
            {formatDisplay(date)}
          </h1>

          {!entry ? (
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-8 text-center">
              <p className="text-neutral-500">この日の記録はありません</p>
              {isToday && (
                <Link
                  href="/today"
                  className="mt-4 inline-block rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary-600"
                >
                  今日のほしふみを書く
                </Link>
              )}
            </div>
          ) : (
            <EntryDetail entry={entry} />
          )}
        </div>
      </div>
    </main>
  );
}

function EntryDetail({
  entry,
}: {
  entry: NonNullable<Awaited<ReturnType<typeof getEntryByDate>>>;
}) {
  const bodyAnswer = entry.answers?.find((a) => a.question_position === 1);
  const textAnswer = entry.answers?.find((a) => a.question_position === 2);
  const closureAnswer = entry.answers?.find((a) => a.question_position === 3);

  const body = BODY_SENSATION_OPTIONS.find(
    (m) => m.value === bodyAnswer?.value_number,
  );

  // ADR-014: Q3 now stored in value_text; older v0 entries may have value_choice.
  const closureText = closureAnswer?.value_text ?? closureAnswer?.value_choice ?? null;

  return (
    <div className="space-y-4">
      <Section label="いまの体の感じ">
        {body ? (
          <div className="flex items-center gap-3">
            <MoonPhase phase={body.value} className="w-10 h-10" />
            <span className="text-base text-neutral-700">{body.label}</span>
          </div>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>

      <Section label="今日いちばん印象に残ったこと">
        {textAnswer?.value_text ? (
          <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {textAnswer.value_text}
          </p>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>

      <Section label="明日の自分にひとことだけ">
        {closureText ? (
          <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {closureText}
          </p>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>

      <p className="text-xs text-neutral-400 pt-2">
        記録日時:{" "}
        {entry.completed_at &&
          new Date(entry.completed_at).toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-5 space-y-2">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <div>{children}</div>
    </div>
  );
}
