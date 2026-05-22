import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingPicker } from "./_components/OnboardingPicker";

// ADR-025: 初回ログイン後のテンプレ選択画面。
// template_name 設定済み(onboarding 済み)なら /today へ弾く。
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("template_name")
    .eq("id", user.id)
    .single();

  if (profile?.template_name) {
    redirect("/today");
  }

  return (
    <main className="min-h-dvh flex flex-col">
      <div className="px-6 py-12 max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">
            どんな夜を綴る?
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            日記のテンプレートを選んでください。あとから設定で変えられます。
          </p>
        </div>
        <OnboardingPicker />
      </div>
    </main>
  );
}
