import { redirect } from "next/navigation";
import { todayJST, formatDisplay } from "@/lib/utils/date";
import { getEntryByDate } from "@/lib/server-actions/entries";
import { createClient } from "@/lib/supabase/server";
import { QuestionFlow } from "./_components/QuestionFlow";
import { AppHeader } from "@/components/AppHeader";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ADR-025: テンプレ未選択(onboarding 未完了)なら onboarding へ誘導
  const { data: profile } = await supabase
    .from("profiles")
    .select("template_name")
    .eq("id", user.id)
    .single();
  if (!profile?.template_name) {
    redirect("/onboarding");
  }

  const today = todayJST();
  const entry = await getEntryByDate(today);
  const isCompleted = !!entry?.completed_at;

  // 編集なら entry 自身の template、新規ならユーザー設定の template
  const templateName = entry
    ? (entry.template_name ?? "basic")
    : profile.template_name;

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
          initialTemplateName={templateName}
        />
      </div>
    </main>
  );
}
