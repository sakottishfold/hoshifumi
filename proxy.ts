import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Supabase env varが未設定なら proxy をスキップ(setup前のローカル動作確認用)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // api/cron/* は Vercel Cron が CRON_SECRET ヘッダで自己認証するため、
    // Supabase セッション check を通すと未認証扱いで /login にリダイレクトされてしまう。
    // matcher から除外して proxy 自体を走らせない。
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|api/cron|icon-.*\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
