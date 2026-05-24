// lib/supabase/service.ts
// Service-role Supabase client(RLS を bypass)。
// CLAUDE.md 方針:trigger 関数 / cron jobs / 管理スクリプトのみ使用可。
// 通常の user-facing code path では絶対に使わない。

import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
