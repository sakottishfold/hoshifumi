import { todayJST, formatDisplay } from "@/lib/utils/date";
import { getEntryByDate, getLastUsedTemplate } from "@/lib/server-actions/entries";
import { QuestionFlow } from "./_components/QuestionFlow";
import { AppHeader } from "@/components/AppHeader";

export default async function TodayPage() {
  const today = todayJST();
  const entry = await getEntryByDate(today);
  const isCompleted = !!entry?.completed_at;

  // 追加テンプレート: 編集なら entry 自身の template、新規なら直近 entry の template(sticky last-used)
  const initialTemplateName = entry
    ? (entry.template_name ?? "basic")
    : await getLastUsedTemplate();

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-8 max-w-md mx-auto">
        <div className="mb-8 text-center">
          <p className="text-xs text-neutral-500">
            {formatDisplay(today)}
          </p>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1">
            {isCompleted ? "今日のほしふみ" : "今日のほしふみ、はじめよう"}
          </h1>
        </div>
        <QuestionFlow
          initialEntry={entry}
          date={today}
          displayDate={formatDisplay(today)}
          initialTemplateName={initialTemplateName}
        />
      </div>
    </main>
  );
}
