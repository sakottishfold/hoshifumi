"use client";

// ADR-025: 設定画面のテンプレ変更 UI。閉じた状態は現在テンプレを表示、
// タップで TemplatePicker を inline 展開。選択で setTemplate → 画面更新。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/constants/template";
import { TemplatePicker } from "@/components/TemplatePicker";
import { setTemplate } from "@/lib/server-actions/profile";
import type { TemplateName } from "@/lib/types";

interface Props {
  current: string;
}

export function TemplateSetting({ current }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = TEMPLATES[current as TemplateName] ?? TEMPLATES.basic;

  function handleSelect(name: TemplateName) {
    startTransition(async () => {
      await setTemplate(name);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-neutral-50 px-4 py-3 flex items-center justify-between text-sm hover:bg-neutral-100"
      >
        <span className="text-neutral-600">いまのテンプレート</span>
        <span className="text-neutral-900 font-medium">{t.displayName}</span>
      </button>
    );
  }

  return (
    <div className="bg-neutral-50 px-4 py-3 space-y-2">
      <TemplatePicker
        current={current}
        onSelect={handleSelect}
        disabled={pending}
      />
    </div>
  );
}
