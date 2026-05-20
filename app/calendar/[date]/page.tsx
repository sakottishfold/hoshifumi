import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getEntryByDate } from "@/lib/server-actions/entries";
import { formatDisplay, todayJST } from "@/lib/utils/date";
import { BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { AppHeader } from "@/components/AppHeader";
import { MoonPhase } from "@/components/MoonPhase";
import { QuestionFlow } from "@/app/today/_components/QuestionFlow";

interface Props {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export default async function EntryDetailPage({ params, searchParams }: Props) {
  const { date } = await params;
  const { edit } = await searchParams;

  // 簡易バリデーション (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const today = todayJST();
  const isFuture = date > today;
  const editing = edit === "1";

  // 未来日は読み書き両方 reject (spec §3.4)
  if (isFuture) {
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
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-8 text-center">
              <p className="text-neutral-500">未来は書けません</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const entry = await getEntryByDate(date);

  // mode C: 編集モード (?edit=1)
  if (editing) {
    return (
      <main className="min-h-dvh">
        <AppHeader />
        <div className="px-6 py-8 max-w-md mx-auto">
          <Link
            href={`/calendar/${date}`}
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            やめる
          </Link>
          <div className="mb-8 text-center">
            <p className="text-xs text-neutral-500">{formatDisplay(date)}</p>
            <h1 className="text-2xl font-bold text-neutral-900 mt-1">
              {entry ? "ほしふみを書き直す" : "この日のほしふみ"}
            </h1>
          </div>
          <QuestionFlow
            initialEntry={entry}
            date={date}
            displayDate={formatDisplay(date)}
          />
        </div>
      </main>
    );
  }

  // mode A: 空欄
  if (!entry) {
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
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-8 text-center space-y-4">
              <p className="text-neutral-500">この日の記録はありません</p>
              <Link
                href={`/calendar/${date}?edit=1`}
                className="inline-block rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary-600"
              >
                この日のほしふみを書く
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // mode B: 既存 entry あり、detail 表示
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
          <EntryDetail entry={entry} />
          <Link
            href={`/calendar/${date}?edit=1`}
            className="block w-full text-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            書き直す
          </Link>
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
  const aiAnswer = entry.answers?.find((a) => a.question_position === 4);

  const body = BODY_SENSATION_OPTIONS.find(
    (m) => m.value === bodyAnswer?.value_number,
  );

  // ADR-023: Q3 は chip(value_choice) or text(value_text) 排他。
  // ADR-014 期 entries は value_text のみ、v0 期は value_choice、それぞれ自然に分岐。
  const q3Chip = closureAnswer?.value_choice ?? null;
  const q3Text = closureAnswer?.value_text ?? null;

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

      {/* ADR-012: AI follow-up question + 回答(pos 4)。Phase 0 entries には pos 4 がないので skip。 */}
      {aiAnswer && (aiAnswer.question_text || aiAnswer.value_text) && (
        <Section label="AI からの問い">
          {aiAnswer.question_text && (
            <p className="text-sm text-neutral-500 leading-relaxed mb-3 whitespace-pre-wrap">
              {aiAnswer.question_text}
            </p>
          )}
          {aiAnswer.value_text ? (
            <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
              {aiAnswer.value_text}
            </p>
          ) : (
            <p className="text-neutral-400">記録なし</p>
          )}
        </Section>
      )}

      <Section label="明日の自分にひとことだけ">
        {q3Chip ? (
          <span className="inline-block rounded-full bg-primary-50 border border-primary-100 px-3 py-1 text-sm text-primary-700">
            {q3Chip}
          </span>
        ) : q3Text ? (
          <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {q3Text}
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
