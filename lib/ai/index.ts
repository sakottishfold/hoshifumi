// lib/ai/index.ts
// provider 切替の唯一の場所。env AI_PROVIDER で gemini / anthropic を選択。
// v1.1+ で Anthropic 実装が入ったら env 切替のみで動く設計。

import * as gemini from "./providers/gemini";
import * as anthropic from "./providers/anthropic";
import { ChatError, type ChatRequest, type ChatResponse } from "./types";

export * from "./types";

const PROVIDER = process.env.AI_PROVIDER ?? "gemini";

/**
 * provider-agnostic chat 呼び出し。env AI_PROVIDER で gemini / anthropic 切替。
 * retry / timeout は呼び出し側で wrapping する想定(本 entry は 1 回呼び出し)。
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  switch (PROVIDER) {
    case "gemini":
      return gemini.chat(req);
    case "anthropic":
      return anthropic.chat(req);
    default:
      throw new ChatError(
        "provider_unavailable",
        `Unknown AI provider: ${PROVIDER} (expected "gemini" or "anthropic")`,
      );
  }
}
