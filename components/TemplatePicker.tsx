"use client";

// ADR-025: onboarding 画面と設定画面で共有するテンプレ5択ピッカー。
// 選択は親に onSelect で通知する(永続化は親が setTemplate action 経由で行う)。

import { TEMPLATES, TEMPLATE_LIST } from "@/lib/constants/template";
import type { TemplateName } from "@/lib/types";

interface Props {
  /** 現在選択中のテンプレ。onboarding では null(未選択)。 */
  current: string | null;
  onSelect: (name: TemplateName) => void;
  /** 選択処理中などに操作を止める。 */
  disabled?: boolean;
}

export function TemplatePicker({ current, onSelect, disabled }: Props) {
  return (
    <div className="space-y-2">
      {TEMPLATE_LIST.map((name) => {
        const t = TEMPLATES[name];
        const isCurrent = name === current;
        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(name)}
            className={
              isCurrent
                ? "w-full flex items-center gap-3 rounded-xl bg-primary-50 border border-primary-200 px-4 py-3 text-left disabled:opacity-50"
                : "w-full flex items-center gap-3 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-left hover:bg-neutral-100 disabled:opacity-50"
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
