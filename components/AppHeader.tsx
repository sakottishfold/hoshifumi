import Link from "next/link";
import { Calendar, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_days")
    .eq("id", user.id)
    .single();

  return (
    <header className="sticky top-0 z-10 bg-neutral-50/80 backdrop-blur-md border-b border-neutral-200/60">
      <div className="px-4 py-3 max-w-md mx-auto flex items-center justify-between">
        <Link href="/today" className="flex items-center gap-2 text-neutral-900">
          <img src="/icon-mark.svg" alt="" className="w-5 h-5" />
          <span className="font-bold">ほしふみ</span>
        </Link>
        <div className="flex items-center gap-1">
          {profile && profile.streak_days > 0 && (
            <span className="text-xs font-medium text-primary-600 bg-primary-50 rounded-full px-2.5 py-1 mr-1">
              {profile.streak_days}つ灯った
            </span>
          )}
          <Link
            href="/calendar"
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
            aria-label="カレンダー"
          >
            <Calendar className="w-5 h-5" />
          </Link>
          <Link
            href="/settings"
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
            aria-label="設定"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
