"use server";

// AI follow-up question 生成の Server Action(ADR-024 multi-turn)。
// retry / timeout は本層で管理。AI は毎ターン構造化出力で ask/close を返す。
// 失敗は throw せず { error } / { done } を返す(silent skip / graceful close 動線)。

import { chat, ChatError, type ChatErrorReason } from "@/lib/ai";
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  FOLLOW_UP_RESPONSE_SCHEMA,
  buildFollowUpMessages,
  type FollowUpInput,
  type FollowUpAction,
} from "@/lib/ai/prompts/follow-up";

const MAX_RETRIES = 1;
/** AI follow-up の合計問い数キャップ(初問 + 深堀り最大2回)。 */
const MAX_TURNS = 3;

export interface FollowUpQuestionResult {
  question: string;
}
export interface FollowUpDoneResult {
  done: true;
}
export interface FollowUpErrorResponse {
  error: ChatErrorReason;
}
export type FollowUpOutcome =
  | FollowUpQuestionResult
  | FollowUpDoneResult
  | FollowUpErrorResponse;

/** AI の JSON 出力を parse。不正なら null。 */
function parseAction(text: string): FollowUpAction | null {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    if (
      obj.action === "ask" &&
      typeof obj.question === "string" &&
      obj.question.trim().length > 0
    ) {
      return { action: "ask", question: obj.question.trim() };
    }
    if (obj.action === "close") {
      return { action: "close" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Q1 + Q2 + これまでの対話履歴を入力に、次の AI follow-up outcome を返す。
 * { question } = 次の問い / { done } = 対話終了 / { error } = 失敗(初問のみ)。
 * 2問目以降の失敗・不正出力は graceful close({ done })に倒し、対話を失わない。
 */
export async function generateFollowUpQuestion(
  input: FollowUpInput,
): Promise<FollowUpOutcome> {
  // Q2 空チェック(防御、submit validation で防ぐ前提だが念のため)
  if (!input.freeText || input.freeText.trim().length === 0) {
    return { error: "empty_response" };
  }
  // キャップ:3問完了済みなら AI を呼ばず close
  if (input.dialog.length >= MAX_TURNS) {
    return { done: true };
  }

  const isFirst = input.dialog.length === 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await chat({
        system: FOLLOW_UP_SYSTEM_PROMPT,
        messages: buildFollowUpMessages(input),
        temperature: 0.4,
        maxOutputTokens: 150,
        timeoutMs: 8000,
        responseSchema: FOLLOW_UP_RESPONSE_SCHEMA,
      });
      const action = parseAction(response.text);
      if (action === null) {
        // parse 不能:初問は silent skip、2問目以降は graceful close
        return isFirst ? { error: "empty_response" } : { done: true };
      }
      if (action.action === "close") {
        return { done: true };
      }
      return { question: action.question };
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      const reason: ChatErrorReason =
        err instanceof ChatError ? err.reason : "api_error";
      // rate_limit は retry 無意味、即返す
      if (reason === "rate_limit" || isLast) {
        return isFirst ? { error: reason } : { done: true };
      }
      // それ以外は continue で retry
    }
  }

  // 到達しないはずだが exhaustiveness のため
  return isFirst ? { error: "api_error" } : { done: true };
}
