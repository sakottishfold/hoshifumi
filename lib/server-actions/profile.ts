"use server";

// ADR-025: ユーザープロファイルの更新 Server Action。
// 現状はテンプレ設定のみ。onboarding 画面と設定画面の両方から呼ばれる。

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_LIST } from "@/lib/constants/template";
import type { TemplateName } from "@/lib/types";

/**
 * 認証ユーザーの profiles.template_name を更新する。
 * 不明な template 名は拒否する。
 */
export async function setTemplate(templateName: string): Promise<void> {
  if (!TEMPLATE_LIST.includes(templateName as TemplateName)) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ template_name: templateName })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/today");
  revalidatePath("/settings");
}
