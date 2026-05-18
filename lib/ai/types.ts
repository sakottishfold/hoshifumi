// lib/ai/types.ts
// AI provider 抽象化のための共有 type。
// provider (Gemini, Anthropic, etc.) はこの interface に conform する。

/** chat message の role */
export type MessageRole = "system" | "user" | "model";

/** chat message */
export interface Message {
  role: MessageRole;
  content: string;
}

/** chat 呼び出し input */
export interface ChatRequest {
  /** system prompt(1 件のみ、roles で system message は別扱い)*/
  system: string;
  /** user message(few-shot example の "user" + final user message も含む)+ "model" の応答(few-shot 用)*/
  messages: Message[];
  /** 0.0 〜 1.0、default 0.4 */
  temperature?: number;
  /** 上限トークン数、default 100 */
  maxOutputTokens?: number;
  /** timeout ms、default 8000 */
  timeoutMs?: number;
  /** retry 回数、default 1 */
  maxRetries?: number;
}

/** chat 呼び出し success response */
export interface ChatResponse {
  text: string;
}

/** chat 呼び出し失敗時の type */
export type ChatErrorReason =
  | "timeout"
  | "rate_limit"
  | "api_error"
  | "empty_response"
  | "provider_unavailable";

export class ChatError extends Error {
  constructor(
    public reason: ChatErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}
