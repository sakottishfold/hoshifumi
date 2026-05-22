"use client";

// 追加テンプレート spec §7.1。/today step 0 で current template を表示 + inline 展開で切替。
// state(open/closed)は component 内 local、選択は親(QuestionFlow)に onSelect 通知。

import { useState } from "react";
import { TEMPLATES, TEMPLATE_LIST } from "@/lib/constants/template";
import type { TemplateName } from "@/lib/types";

interface Props {
  current: TemplateName;
  onSelect: (name: TemplateName) => void;
}

export function TemplateSwitcher({ current, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
      >
        {TEMPLATES[current].displayName}
        <span className="text-neutral-400">▾</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-2 space-y-1">
      {TEMPLATE_LIST.map((name) => {
        const t = TEMPLATES[name];
        const isCurrent = name === current;
        return (
          <button
            key={name}
            type="button"
            onClick={() => {
              onSelect(name);
              setOpen(false);
            }}
            className={
              isCurrent
                ? "w-full flex items-center gap-3 rounded-xl bg-primary-50 px-3 py-2 text-left"
                : "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-neutral-100"
            }
          >
            <span className="text-base font-medium text-neutral-900 w-20 shrink-0">
              {t.displayName}
            </span>
            <span className="text-sm text-neutral-500 flex-1">
              {t.description}
            </span>
            {isCurrent && <span className="text-primary-600 text-sm">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
