// ADR-017: Past-entry callback card. Surfaced on /today/done after submission.
// 引用係原則 (ADR-016): No AI commentary on the card. Entry text shown verbatim.
//
// Contract (Contract-clear pattern per implementing-features skill):
// - Caller MUST pre-filter entries with empty entryText. This component trusts caller;
//   no defensive return null. Loud failure if caller violates is intentional.
// - bodyPhase is optional — older entries without body_sensation will render label-only.
//
// Props are NARROW (Narrow props pattern): only the fields rendered are accepted,
// not the full EntryWithAnswers entity. Integration adapter converts at callsite.
// This decouples the component from any future schema changes (ADR-012 schema migration etc.).
//
// Style: highlight card variant (`rounded-2xl bg-primary-50 border border-primary-100 p-6`)
// matches existing streak card and QuestionFlow review preview for whole-app consistency.

import { MoonPhase } from "@/components/MoonPhase";

interface Props {
  /** 例: "5月12日(月)" — caller formats via formatDisplay */
  dateLabel: string;
  /** Q1 body sensation phase 1-5、null/undefined ならアイコン非表示 */
  bodyPhase?: 1 | 2 | 3 | 4 | 5;
  /** Q2 自由記述、verbatim 表示 */
  entryText: string;
  /** 例: "数日前のあなた" / "ひと月前のあなた" / "1年前のあなた" */
  stageLabel: string;
}

export function CallbackCard({
  dateLabel,
  bodyPhase,
  entryText,
  stageLabel,
}: Props) {
  return (
    <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6 space-y-4 text-left">
      <p className="text-xs font-medium text-primary-700">{stageLabel}</p>

      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-500">{dateLabel}</span>
        {bodyPhase !== undefined && (
          <MoonPhase phase={bodyPhase} className="w-4 h-4" />
        )}
      </div>

      <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
        {entryText}
      </p>
    </div>
  );
}
