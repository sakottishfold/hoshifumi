// lib/ai/providers/anthropic.ts
// v1.1+ で実装する想定の stub。interface 整合のみ、呼ばれたら throw。
// Phase 1 では gemini.ts のみ使われる(env AI_PROVIDER=gemini)。

import { ChatError, type ChatRequest, type ChatResponse } from "@/lib/ai/types";

export async function chat(_req: ChatRequest): Promise<ChatResponse> {
  throw new ChatError(
    "provider_unavailable",
    "Anthropic provider is not implemented yet (v1.1+ scope, see ADR-021)",
  );
}
