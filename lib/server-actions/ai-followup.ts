"use server";

// AI follow-up question 生成の Server Action。
// retry / timeout は本層で管理(lib/ai/providers/gemini.ts は 1 回呼び出しに集中)。
// 失敗は client に { error: ChatErrorReason } を返す ─ throw しない(silent skip 動線のため)。

import { chat, ChatError, type ChatErrorReason } from "@/lib/ai";
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpMessages,
  type FollowUpInput,
} from "@/lib/ai/prompts/follow-up";

const MAX_RETRIES = 1;

export interface FollowUpResult {
  question: string;
}

export interface FollowUpErrorResponse {
  error: ChatErrorReason;
}

/**
 * Q1(体感)+ Q2(自由記述)を入力に AI follow-up question を生成。
 * 成功 = { question }、失敗 = { error: reason }。
 * retry 1 回まで、失敗時は client が silent skip を選択する想定。
 */
export async function generateFollowUpQuestion(
  input: FollowUpInput,
): Promise<FollowUpResult | FollowUpErrorResponse> {
  // Q2 空チェック(防御、submit validation で防ぐ前提だが念のため)
  if (!input.freeText || input.freeText.trim().length === 0) {
    return { error: "empty_response" };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await chat({
        system: FOLLOW_UP_SYSTEM_PROMPT,
        messages: buildFollowUpMessages(input),
        temperature: 0.4,
        maxOutputTokens: 100,
        timeoutMs: 8000,
      });
      return { question: response.text };
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      const reason: ChatErrorReason =
        err instanceof ChatError ? err.reason : "api_error";

      // rate_limit は retry しても無意味、即返す
      if (reason === "rate_limit" || isLast) {
        return { error: reason };
      }
      // それ以外は continue で retry
    }
  }

  // 到達しないはずだが TypeScript の exhaustiveness のため
  return { error: "api_error" };
}
