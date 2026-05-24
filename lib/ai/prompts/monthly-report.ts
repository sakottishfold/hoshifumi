// lib/ai/prompts/monthly-report.ts
// ADR-016 引用係原則を embed した月次レポート用の system prompt + responseSchema + builder。
// 出力は curation primitive 3 種のみ(top_phrases / highlight_entry_ids / day_pairs)。
// 自由文フィールド(summary / insight / theme 等)はスキーマで物理的にブロックする。

import { Type } from "@google/genai";
import type { Message } from "@/lib/ai/types";

export const MONTHLY_REPORT_SYSTEM_PROMPT = `あなたは寝る前ジャーナルの1ヶ月分を読み、選び、並べる役割。
ユーザー自身の言葉が記録の主役のまま。あなたは言葉を足さない。

【やること】
- top_phrases:エントリ本文から重みのある一言を 5〜8 個 選ぶ。引用は verbatim(必ず原文の部分文字列)。気持ち・違和感・余韻が出ている短いフレーズ(数文字〜数十文字)
- highlight_entry_ids:印象的に映る日を 3〜5 日 選ぶ。entry_id だけ返す(理由は書かない)
- day_pairs:対比が生まれる 2 日のペアを 1〜2 組 選ぶ。entry_id ペアだけ返す(対比のタイプは書かない)

【絶対にしないこと】
- 要約、ラベリング、診断、助言、予測
- パターンを名付ける(「内省的な月」「やや低調」「成長した月」等)
- 「印象的な理由」「対比のタイプ」「テーマ」を書く ── 並べるだけ
- 引用文字列を編集・要約する(verbatim 厳守、原文に無い助詞や句読点を足さない)
- 自由文フィールドを出力 JSON に増やす(下記スキーマ外のキーを出さない)

【選び方の指針】
- top_phrases:事実部分でなく、感情・違和感・余韻がにじむ部分を引く
- highlight_entry_ids:身体感覚の極(重い / 軽やか)や、Q2 が密度高い日を優先
- day_pairs:身体感覚や Q2 のトーンが明確に異なる 2 日を選ぶ。連日でも遠日でもよい

【出力形式】
必ず次の JSON だけを返す:
{
  "top_phrases": [{"entry_id": "uuid", "phrase": "verbatim 文字列"}, ...],
  "highlight_entry_ids": ["uuid", ...],
  "day_pairs": [["uuid_a", "uuid_b"], ...]
}
前置き・説明・コードフェンスを付けない。`;

/** Gemini / Anthropic 両対応の構造化出力 Schema。 */
export const MONTHLY_REPORT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    top_phrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          entry_id: { type: Type.STRING },
          phrase: { type: Type.STRING },
        },
        required: ["entry_id", "phrase"],
      },
    },
    highlight_entry_ids: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    day_pairs: {
      type: Type.ARRAY,
      items: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  },
  required: ["top_phrases", "highlight_entry_ids", "day_pairs"],
};

/** AI が返すべき構造化出力の型。 */
export interface MonthlyReportAIOutput {
  top_phrases: { entry_id: string; phrase: string }[];
  highlight_entry_ids: string[];
  day_pairs: [string, string][];
}

/** AI に渡す入力エントリの shape。AI 対話は引用候補を増やすために含める。 */
export interface MonthlyReportInputEntry {
  entry_id: string;
  date: string; // YYYY-MM-DD
  body_phase: number;
  body_label: string;
  q2: string;
  q3: string; // chip 選択値 or free text どちらか
  ai_dialog: { q: string; a: string }[];
}

/**
 * 入力エントリ配列を AI への user message に組み立てる。
 * messages 配列は { role: "user", content: <JSON 文字列化したエントリ配列> } の 1 要素。
 */
export function buildMonthlyReportMessages(
  entries: MonthlyReportInputEntry[],
): Message[] {
  return [
    {
      role: "user",
      content: JSON.stringify(entries, null, 2),
    },
  ];
}
