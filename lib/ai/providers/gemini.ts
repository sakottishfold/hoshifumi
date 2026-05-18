// lib/ai/providers/gemini.ts
// Gemini 2.0 Flash 実装。@google/genai SDK を使う。
// timeout は AbortController で、retry は server-action 層(ai-followup.ts)で管理。
// このファイルは 1 回の呼び出しに集中(retry なし)。

import { ApiError, GoogleGenAI } from "@google/genai";
import { ChatError, type ChatRequest, type ChatResponse } from "@/lib/ai/types";

const MODEL = "gemini-2.0-flash";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ChatError(
      "provider_unavailable",
      "GEMINI_API_KEY is not set in env",
    );
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * 1 回 chat 呼び出し。timeout 内に response が来なければ ChatError("timeout") を throw。
 * 呼び出し側で retry 制御する想定。
 */
export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const ai = getClient();
  const timeoutMs = req.timeoutMs ?? 8000;

  // Gemini SDK の contents 形式に変換: system は config.systemInstruction、
  // それ以外は contents 配列(role + parts)
  const contents = req.messages.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxOutputTokens ?? 100,
        abortSignal: controller.signal,
      },
    });

    const text = result.text;
    if (!text || text.trim().length === 0) {
      throw new ChatError("empty_response", "Gemini returned empty text");
    }
    return { text: text.trim() };
  } catch (err) {
    if (err instanceof ChatError) throw err;

    // AbortError → timeout(AbortController.abort() を契機)
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new ChatError("timeout", `Gemini request exceeded ${timeoutMs}ms`);
    }

    // SDK が返す ApiError は status code を持つ
    if (err instanceof ApiError) {
      if (err.status === 429) {
        throw new ChatError("rate_limit", `Gemini rate limit: ${err.message}`);
      }
      throw new ChatError(
        "api_error",
        `Gemini API error (status ${err.status}): ${err.message}`,
      );
    }

    // fallback: 文字列 heuristic(SDK が ApiError でラップしないケース対策)
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("429") || message.toLowerCase().includes("rate")) {
      throw new ChatError("rate_limit", `Gemini rate limit: ${message}`);
    }

    throw new ChatError("api_error", `Gemini API error: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
