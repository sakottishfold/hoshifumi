import type { Template, MoodOption } from "@/lib/types";

// ADR-013: renamed from MOOD_OPTIONS. Q1 semantics shifted from "気分" to "いまの体の感じ".
// The MoodOption interface is reused as a generic 5-tap option type.
// `emoji` field carries the semantic moon-phase unicode (new moon → full moon) as a
// fallback / data label, but the visual rendering uses the <MoonPhase phase={value}/>
// component (see components/MoonPhase.tsx) for brand-consistent custom SVG.
export const BODY_SENSATION_OPTIONS: MoodOption[] = [
  { value: 1, emoji: "🌑", label: "重たい" },
  { value: 2, emoji: "🌒", label: "ざわざわ" },
  { value: 3, emoji: "🌓", label: "ふつう" },
  { value: 4, emoji: "🌔", label: "軽い" },
  { value: 5, emoji: "🌕", label: "軽やか" },
];

export const BASIC_TEMPLATE: Template = {
  name: "basic",
  emoji: "🌒",
  description: "体・できごと・明日へ",
  questions: [
    {
      position: 1,
      text: "いまの体の感じは?",
      input_type: "mood_5",
      options: BODY_SENSATION_OPTIONS,
    },
    {
      position: 2,
      text: "今日いちばん印象に残ったこと",
      input_type: "free_text",
      placeholder: "ひとことでも、ふたことでも",
    },
    {
      position: 3,
      // ADR-014: input_type changed from short_choice to free_text. Closure-focused single line.
      text: "明日の自分にひとことだけ",
      input_type: "free_text",
      placeholder: "短く、ひと言で",
    },
  ],
};
