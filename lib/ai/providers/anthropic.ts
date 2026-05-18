// lib/ai/providers/anthropic.ts
// Claude Haiku 4.5 実装。@anthropic-ai/sdk を使う。
// timeout は AbortController で、retry は server-action 層(ai-followup.ts)で管理。
// このファイルは 1 回の呼び出しに集中(retry なし)。
//
// ADR-021 では Phase 1 = Gemini としていたが、Gemini free tier の limit:0 issue
// 回避のため一時的に Claude Haiku を採用。owner 規模(月 ~15K tokens)では
// 月 ~$0.01 (約 1.5 円) で実費許容範囲。将来 Gemini billing 解決 or v1.1+ で
// adr-keeper 経由で ADR-021 を update or 新 ADR で扱う。

import Anthropic from "@anthropic-ai/sdk";
import { ChatError, type ChatRequest, type ChatResponse } from "@/lib/ai/types";

// claude-haiku-4-5(dated form: claude-haiku-4-5-20251001)
// 最安、follow-up question の精度 + JP には十分
const MODEL = "claude-haiku-4-5";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ChatError(
      "provider_unavailable",
      "ANTHROPIC_API_KEY is not set in env",
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * 1 回 chat 呼び出し。timeout 内に response が来なければ ChatError("timeout") を throw。
 * 呼び出し側で retry 制御する想定。
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const client = getClient();
  const timeoutMs = req.timeoutMs ?? 8000;

  // Anthropic Messages API:
  // - system は top-level の separate param(messages 配列の "system" role じゃない)
  // - messages は "user" / "assistant" role(types.ts は "model" を使うので mapping 必要)
  const messages = req.messages.map((m) => ({
    role: (m.role === "model" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        system: req.system,
        messages,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxOutputTokens ?? 100,
      },
      { signal: controller.signal },
    );

    // Anthropic Messages API は content として block 配列を返す(text / tool_use 等)
    // text block を探して text を取り出す
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    if (!text || text.trim().length === 0) {
      throw new ChatError(
        "empty_response",
        "Anthropic returned empty text",
      );
    }
    return { text: text.trim() };
  } catch (err) {
    if (err instanceof ChatError) throw err;

    // AbortError → timeout(Anthropic SDK は AbortController を signal で受ける)
    // SDK は abort を APIUserAbortError でラップする場合も、Error("AbortError") の場合もある
    if (err instanceof Anthropic.APIUserAbortError) {
      throw new ChatError(
        "timeout",
        `Anthropic request exceeded ${timeoutMs}ms`,
      );
    }
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new ChatError(
        "timeout",
        `Anthropic request exceeded ${timeoutMs}ms`,
      );
    }

    // Anthropic SDK の APIError は status を持つ
    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        throw new ChatError(
          "rate_limit",
          `Anthropic rate limit: ${err.message}`,
        );
      }
      throw new ChatError(
        "api_error",
        `Anthropic API error ${err.status}: ${err.message}`,
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    throw new ChatError("api_error", `Anthropic error: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
