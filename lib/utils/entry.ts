// ADR-017 callback / ADR-012 entry shape adapter.
// EntryWithAnswers から CallbackCard の narrow props 用に値を抽出するヘルパー。
// answers の question_position は 1..3 (lib/types.ts) で、Q1=body sensation,
// Q2=free text on today's event, Q3=closure for tomorrow。

import type { EntryWithAnswers } from "@/lib/types";

/**
 * Q1 body sensation の phase 1..5 を返す。
 * answer が無い / value_number が null / 範囲外なら undefined。
 */
export function extractBodyPhase(
  entry: EntryWithAnswers,
): 1 | 2 | 3 | 4 | 5 | undefined {
  const answer = entry.answers.find((a) => a.question_position === 1);
  const n = answer?.value_number;
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) {
    return n;
  }
  return undefined;
}

/**
 * Q2 free text を verbatim で返す (引用係原則、ADR-016)。
 * answer が無い / value_text が null なら空文字。
 */
export function extractFreeText(entry: EntryWithAnswers): string {
  const answer = entry.answers.find((a) => a.question_position === 2);
  return answer?.value_text ?? "";
}
