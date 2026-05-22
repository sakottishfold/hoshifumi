import type { Template, TemplateName, MoodOption, Question } from "@/lib/types";

// ADR-013: renamed from MOOD_OPTIONS. Q1 semantics shifted from "気分" to "いまの体の感じ".
// `emoji` carries the moon-phase unicode as data label; visual is <MoonPhase phase={value}/>.
export const BODY_SENSATION_OPTIONS: MoodOption[] = [
  { value: 1, emoji: "🌑", label: "重たい" },
  { value: 2, emoji: "🌒", label: "ざわざわ" },
  { value: 3, emoji: "🌓", label: "ふつう" },
  { value: 4, emoji: "🌔", label: "軽い" },
  { value: 5, emoji: "🌕", label: "軽やか" },
];

// ADR-023: Q3 chip options(全テンプレ共通)
const Q3_CHIPS = ["明日もがんばる", "ゆっくり眠る", "今日はここまで", "そのままで"];

// 全テンプレ共通の 3-beat ritual。Q2 の文言だけテンプレ別(spec: 追加テンプレート §3)。
// Q1 体感(ADR-013)・Q3 chip(ADR-023)は固定。
function buildQuestions(q2Text: string, q2Placeholder: string): Question[] {
  return [
    {
      position: 1,
      text: "いまの体の感じは?",
      input_type: "mood_5",
      options: BODY_SENSATION_OPTIONS,
    },
    {
      position: 2,
      text: q2Text,
      input_type: "free_text",
      placeholder: q2Placeholder,
    },
    {
      position: 3,
      text: "明日の自分にひとことだけ",
      // ADR-023: chip + text escape hybrid
      input_type: "chip_with_text",
      placeholder: "思ったままに",
      options: Q3_CHIPS,
    },
  ];
}

export const TEMPLATES: Record<TemplateName, Template> = {
  basic: {
    name: "basic",
    displayName: "ほしふみ",
    emoji: "🌒",
    description: "体・できごと・明日へ",
    questions: buildQuestions(
      "今日いちばん印象に残ったこと",
      "ひとことでも、ふたことでも",
    ),
  },
  work: {
    name: "work",
    displayName: "仕事",
    emoji: "🌒",
    description: "仕事の一日を置く",
    questions: buildQuestions(
      "今日の仕事で、心に残ったこと",
      "うまくいったことも、そうでないことも",
    ),
  },
  parenting: {
    name: "parenting",
    displayName: "子育て",
    emoji: "🌒",
    description: "子どもとの一日を置く",
    questions: buildQuestions("今日の子どもとのこと", "小さなことでも"),
  },
  making: {
    name: "making",
    displayName: "つくる",
    emoji: "🌒",
    description: "つくる一日を置く",
    questions: buildQuestions(
      "今日つくったもの、つくれなかったもの",
      "かたちにならなくても",
    ),
  },
  gratitude: {
    name: "gratitude",
    displayName: "感謝",
    emoji: "🌒",
    description: "ありがたみを置く",
    questions: buildQuestions(
      "今日、ありがたかったこと",
      "誰かのことでも、何かのことでも",
    ),
  },
};

// switcher の表示順
export const TEMPLATE_LIST: TemplateName[] = [
  "basic",
  "work",
  "parenting",
  "making",
  "gratitude",
];

/** template_name から Template を解決。不明 name は basic にフォールバック。*/
export function getTemplate(name: string): Template {
  return TEMPLATES[name as TemplateName] ?? TEMPLATES.basic;
}

// 後方互換:既存 import `BASIC_TEMPLATE` を使う箇所のため alias を残す。
// 新規コードは getTemplate() を使うこと。
export const BASIC_TEMPLATE = TEMPLATES.basic;
