"use client";

// ADR-025: onboarding 画面の client wrapper。
// テンプレを1つ選ぶと setTemplate で永続化し /today へ遷移する。

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TemplatePicker } from "@/components/TemplatePicker";
import { setTemplate } from "@/lib/server-actions/profile";
import type { TemplateName } from "@/lib/types";

export function OnboardingPicker() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSelect(name: TemplateName) {
    startTransition(async () => {
      await setTemplate(name);
      router.push("/today");
    });
  }

  return (
    <TemplatePicker current={null} onSelect={handleSelect} disabled={pending} />
  );
}
