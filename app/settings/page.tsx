import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/server-actions/auth";
import { AppHeader } from "@/components/AppHeader";
import { TemplateSetting } from "./_components/TemplateSetting";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-6 max-w-md mx-auto">
        <Link
          href="/today"
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          戻る
        </Link>

        <h1 className="text-2xl font-bold text-neutral-900 mb-6">設定</h1>

        <section className="space-y-4">
          <SettingsCard title="アカウント">
            <Row label="メールアドレス" value={user.email ?? "—"} />
            <Row
              label="プラン"
              value={
                profile?.plan === "pro"
                  ? "Pro"
                  : profile?.plan === "premium"
                    ? "Premium"
                    : "Free"
              }
            />
          </SettingsCard>

          <SettingsCard title="日記のテンプレート">
            <TemplateSetting current={profile?.template_name ?? "basic"} />
            <p className="text-xs text-neutral-500 px-1">
              変更は次に書くエントリから反映されます
            </p>
          </SettingsCard>

          <SettingsCard title="灯した夜">
            <Row
              label="いま"
              value={`${profile?.streak_days ?? 0}つ`}
            />
            <Row
              label="いちばん長く"
              value={`${profile?.longest_streak ?? 0}つ`}
            />
          </SettingsCard>

          <SettingsCard title="通知 (近日対応)">
            <Row
              label="通知時刻"
              value={profile?.notification_time?.slice(0, 5) ?? "22:00"}
            />
            <p className="text-xs text-neutral-500 px-1">
              プッシュ通知は v1.1 で対応予定
            </p>
          </SettingsCard>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 inline-flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-1">
      <h2 className="text-xs font-medium text-neutral-500 px-4 py-3">
        {title}
      </h2>
      <div className="space-y-px bg-neutral-100 rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-50 px-4 py-3 flex items-center justify-between text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className="text-neutral-900 font-medium">{value}</span>
    </div>
  );
}
