# AI Follow-up Question + `lib/ai/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 寝る前 5 分儀式に AI follow-up question(Q2 引用 + 問い返し)を追加、同時に `lib/ai/` 抽象化基盤を構築。

**Architecture:** `lib/ai/` 抽象化層(provider 切替可能、Phase 1 = Gemini 2.0 Flash)+ `ai-followup.ts` Server Action(retry/timeout)+ `AIQuestionStep.tsx` 新規 UI + `QuestionFlow.tsx` 拡張(Q2 と Q3 の間に AI step を挿入)。失敗時は auto-retry 1 回 + silent skip + 「今夜は静かに進みます」1 行。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript strict / `@google/genai` SDK / Supabase Server Actions

**Spec reference:** `docs/specs/2026-05-18-ai-followup-question-design.md`

---

## File Structure

```
新規:
  lib/ai/
    types.ts                            # Message / ChatRequest / ChatResponse / ChatError types
    providers/
      gemini.ts                         # Gemini 2.0 Flash 実装 (@google/genai)
      anthropic.ts                      # future v1.1+ stub、NotImplementedError throw
    index.ts                            # high-level chat() + provider router
    prompts/
      follow-up.ts                      # system prompt + few-shots + user message builder

  lib/server-actions/ai-followup.ts     # generateFollowUpQuestion() ─ retry/timeout 内包

  app/today/_components/AIQuestionStep.tsx  # loading / question display / input / skip

修正:
  lib/server-actions/entries.ts         # submitEntry に optional aiQuestion / aiAnswer 追加
  app/today/_components/QuestionFlow.tsx  # AI step を Q2 と Q3 の間に挿入

設定 / ドキュメント:
  .env.example                          # GEMINI_API_KEY + AI_PROVIDER 追記
  package.json                          # @google/genai 依存追加
  docs/SPEC.md                          # AI セクション update (Phase 1 = Gemini、フロー詳細)
  docs/NEXT-ACTIONS.md                  # 着手 = in-progress、完了 = closed
```

各ファイル単一責任:
- `lib/ai/types.ts`:type 定義のみ
- `lib/ai/providers/gemini.ts`:Gemini SDK ラップ、provider 内 retry / timeout
- `lib/ai/providers/anthropic.ts`:stub、interface 整合のみ
- `lib/ai/index.ts`:provider router、env で切替
- `lib/ai/prompts/follow-up.ts`:prompt 文字列 + builder、test 容易
- `lib/server-actions/ai-followup.ts`:server-only API、入出力 type narrow
- `AIQuestionStep.tsx`:presentation only、AI fetch + display + input ロジック内包
- `entries.ts`:既存 + optional AI 拡張のみ
- `QuestionFlow.tsx`:state machine 拡張(AI step 挿入)、UI delegation

---

## Task 1: Setup ─ 依存追加 + env 設定

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/package.json`
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/.env.example`
- 自動生成: `/Users/masayafukazawa/workspace/me/hoshifumi/package-lock.json`

- [ ] **Step 1: `@google/genai` をインストール**

Run: `npm install @google/genai`
Expected: `added N packages` メッセージ、package.json に `"@google/genai": "..."` 行追加、package-lock.json 更新

- [ ] **Step 2: `.env.example` に env vars 追加**

`.env.example` の末尾(`NEXT_PUBLIC_SITE_URL` 行の下)に以下を追記:

```
# Gemini API (Phase 1 AI follow-up question + 月次レポート、ADR-021)
# https://aistudio.google.com/apikey から取得、free tier 15 RPM / 1500 RPD
GEMINI_API_KEY=AIzaSy...

# AI provider 切替(optional、default=gemini)。v1.1+ で "anthropic" に切替可能。
AI_PROVIDER=gemini
```

- [ ] **Step 3: typecheck で問題なし確認**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add @google/genai dep + GEMINI_API_KEY env (ADR-021)

Phase 1 AI follow-up の前準備。.env.example に GEMINI_API_KEY と
AI_PROVIDER (default=gemini) を追記、実 key は手動で .env.local に設定。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `lib/ai/types.ts` 新規作成

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/ai/types.ts`

- [ ] **Step 1: types ファイルを作成**

```typescript
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
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add lib/ai/types.ts
git commit -m "feat: lib/ai/types.ts ─ provider 抽象化の共有 type 定義

Message / ChatRequest / ChatResponse / ChatError。providers/ がこの
interface に conform することで Gemini ⇄ Anthropic を env で切替可能。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `lib/ai/providers/gemini.ts` Gemini 2.0 Flash 実装

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/ai/providers/gemini.ts`

- [ ] **Step 1: Gemini provider ファイルを作成**

```typescript
// lib/ai/providers/gemini.ts
// Gemini 2.0 Flash 実装。@google/genai SDK を使う。
// timeout は AbortController で、retry は server-action 層(ai-followup.ts)で管理。
// このファイルは 1 回の呼び出しに集中(retry なし)。

import { GoogleGenAI } from "@google/genai";
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

    // AbortError → timeout
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ChatError("timeout", `Gemini request exceeded ${timeoutMs}ms`);
    }

    // HTTP 429 等(SDK が status code を expose する場合)
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("429") || message.toLowerCase().includes("rate")) {
      throw new ChatError("rate_limit", `Gemini rate limit: ${message}`);
    }

    throw new ChatError("api_error", `Gemini API error: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし(`@google/genai` の type が解決、`abortSignal` field が config に存在するか確認 ─ SDK バージョン依存。もし型エラーが出たら SDK の最新 API ドキュメントで現在の引数名を確認、`config.abortSignal` 不可の場合は SDK レベルの timeout / abort 機構に置換)

- [ ] **Step 3: Commit**

```bash
git add lib/ai/providers/gemini.ts
git commit -m "feat: lib/ai/providers/gemini.ts ─ Gemini 2.0 Flash 実装

@google/genai SDK ラップ。systemInstruction、temperature 0.4 default、
maxOutputTokens 100 default、timeout 8000ms default。
retry は呼び出し側(ai-followup.ts)で管理、本ファイルは 1 回呼び出しに集中。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `lib/ai/providers/anthropic.ts` stub + `lib/ai/index.ts` provider router

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/ai/providers/anthropic.ts`
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/ai/index.ts`

- [ ] **Step 1: anthropic.ts stub を作成**

```typescript
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
```

- [ ] **Step 2: index.ts (provider router) を作成**

```typescript
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
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add lib/ai/providers/anthropic.ts lib/ai/index.ts
git commit -m "feat: lib/ai/{index,providers/anthropic} ─ provider router + stub

index.ts が env AI_PROVIDER で provider 切替。anthropic.ts は v1.1+ 用 stub。
呼び出し側は lib/ai から chat() を import するだけで provider 不問。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `lib/ai/prompts/follow-up.ts` 作成

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/ai/prompts/follow-up.ts`

- [ ] **Step 1: prompt ファイルを作成**

```typescript
// lib/ai/prompts/follow-up.ts
// ADR-016 引用係原則を embed した system prompt + few-shot examples + builder。
// 出力 = Q2 から1フレーズを引用して問い返す1問のみ。

import type { Message } from "@/lib/ai/types";

export const FOLLOW_UP_SYSTEM_PROMPT = `あなたは寝る前のジャーナリングで書かれた文章を読み、そこから「ひっかかる一言」を1つ引用して、問い返す役割。

役割:
- ユーザーの Q2 から短いフレーズ(数文字〜十数文字)を引用形「...」で含める
- それを問い返す1問だけ出力、「なぜ?」「どんな?」「いま思い出して?」など
- 1〜2文の短い質問、句読点緩め

絶対にしないこと:
- ユーザーの状態を要約・ラベリング・診断しない
- 「あなたは○○な人ですね」のような決めつけ
- アドバイス、励まし、共感の表明
- パターンの announce(「いつもこうですね」)
- 質問を2つ以上出す
- 引用なしで抽象的に問う
- 出力に前置きやメタ説明をつけない、1行の質問のみ

トーン:
- 常体「〜?」「〜だね」(敬語禁止)
- 距離近め、ただし押し付けない
- 短い、空白に語らせる`;

export interface FollowUpInput {
  bodySensationLabel: string;
  freeText: string;
}

function buildUserText(input: FollowUpInput): string {
  return `Q1(体感):${input.bodySensationLabel}
Q2(今日のこと):${input.freeText}

→ Q2 から1フレーズを引用して、問い返す1問を出力。`;
}

export const FOLLOW_UP_FEW_SHOTS: Message[] = [
  {
    role: "user",
    content: buildUserText({
      bodySensationLabel: "重たい",
      freeText: "会議で〇〇さんに言われた一言が、まだ引っかかってる。",
    }),
  },
  {
    role: "model",
    content: "「一言が、まだ引っかかってる」って、その引っかかりはどこからきてる?",
  },
  {
    role: "user",
    content: buildUserText({
      bodySensationLabel: "ふつう",
      freeText: "夕方の散歩で、空がやけに静かだった。",
    }),
  },
  {
    role: "model",
    content: "「やけに静か」だった空、いま思い出してどんな?",
  },
  {
    role: "user",
    content: buildUserText({
      bodySensationLabel: "軽やか",
      freeText: "締切に追われて、ごはんが砂を噛むようだった。",
    }),
  },
  {
    role: "model",
    content: "「砂を噛むよう」って、もう少し聞かせて?",
  },
];

/**
 * 実 user の Q1/Q2 を受け取り、Gemini に渡す messages 配列を組み立てる。
 * few-shots → 実 user message の順で配列を返す。
 */
export function buildFollowUpMessages(input: FollowUpInput): Message[] {
  return [
    ...FOLLOW_UP_FEW_SHOTS,
    {
      role: "user",
      content: buildUserText(input),
    },
  ];
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add lib/ai/prompts/follow-up.ts
git commit -m "feat: lib/ai/prompts/follow-up.ts ─ ADR-016 引用係 system prompt + few-shots

system: 引用してから問い返す、要約・診断・アドバイス禁止、1問のみ、常体トーン。
few-shots: 3 例(重たい/ふつう/軽やか × 異なる Q2)、出力の安定化用。
builder: 実 user の Q1/Q2 を messages 配列に組み立て。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `lib/server-actions/ai-followup.ts` 作成

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/server-actions/ai-followup.ts`

- [ ] **Step 1: Server Action ファイルを作成**

```typescript
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
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add lib/server-actions/ai-followup.ts
git commit -m "feat: lib/server-actions/ai-followup.ts ─ generateFollowUpQuestion

Q1+Q2 → AI 質問。retry 1 回、timeout 8s、失敗時は { error: reason } 返す
(throw しない、client が silent skip 選択する設計)。rate_limit は即返す
(retry 無意味)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `submitEntry` を AI 質問 + 回答 受け取りに拡張

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/server-actions/entries.ts`

- [ ] **Step 1: SubmitEntryInput interface に optional fields 追加**

`lib/server-actions/entries.ts` の interface 定義(現状 L9-14)を以下に置換:

```typescript
interface SubmitEntryInput {
  date?: string;
  bodySensation: number; // 1-5, Q1 body sensation tap (was `mood` pre-ADR-013)
  freeText: string;
  tomorrowMessage: string; // Q3 free text closure (was short_choice pre-ADR-014)
  /** ADR-012 AI follow-up question(成功時のみ渡す、skip 時は undefined)*/
  aiQuestion?: string;
  /** ADR-012 AI follow-up に対する user の回答(aiQuestion と必ずセット)*/
  aiAnswer?: string;
}
```

- [ ] **Step 2: answers insert に pos 4 行を条件付き追加**

`submitEntry` 関数内の以下の block(現状 L46-51 あたり):

```typescript
  const answers = [
    { entry_id: entry.id, question_position: 1, value_number: input.bodySensation },
    { entry_id: entry.id, question_position: 2, value_text: input.freeText },
    // ADR-014: Q3 now stored in value_text (was value_choice when Q3 was short_choice in v0).
    { entry_id: entry.id, question_position: 3, value_text: input.tomorrowMessage },
  ];
```

を以下に置換(aiQuestion + aiAnswer が両方あれば pos 4 を追加):

```typescript
  const answers: Array<{
    entry_id: string;
    question_position: number;
    value_number?: number;
    value_text?: string;
    question_text?: string;
  }> = [
    { entry_id: entry.id, question_position: 1, value_number: input.bodySensation },
    { entry_id: entry.id, question_position: 2, value_text: input.freeText },
    // ADR-014: Q3 now stored in value_text (was value_choice when Q3 was short_choice in v0).
    { entry_id: entry.id, question_position: 3, value_text: input.tomorrowMessage },
  ];

  // ADR-012: AI follow-up question + answer を pos 4 に保存(silent skip 時は insert しない)
  if (input.aiQuestion && input.aiAnswer) {
    answers.push({
      entry_id: entry.id,
      question_position: 4,
      question_text: input.aiQuestion,
      value_text: input.aiAnswer,
    });
  }
```

- [ ] **Step 3: typecheck で型整合確認**

Run: `npm run typecheck`
Expected: エラーなし(answers 配列の型を explicit 化、Supabase insert は extra field を黙って受ける)

- [ ] **Step 4: build**

Run: `npm run build`
Expected: success

- [ ] **Step 5: Commit**

```bash
git add lib/server-actions/entries.ts
git commit -m "feat: submitEntry accepts optional aiQuestion + aiAnswer (pos 4)

ADR-012 AI follow-up の保存。両方あれば answers に pos 4 行 insert
(question_text = AI 質問、value_text = user 回答)。silent skip 時は
両方 undefined で insert なし、既存 entries の互換維持。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `AIQuestionStep.tsx` 新規 component

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/AIQuestionStep.tsx`

- [ ] **Step 1: AIQuestionStep component を作成**

```typescript
"use client";

// ADR-012 AI follow-up question UI。
// QuestionFlow から Q2 完了後に render される。
// AI を await して質問取得 → user 回答入力 → onComplete で QuestionFlow に通知。
// 失敗時は onComplete(null, null) で silent skip 通知。

import { useEffect, useState } from "react";
import { generateFollowUpQuestion } from "@/lib/server-actions/ai-followup";

interface Props {
  bodySensationLabel: string;
  freeText: string;
  /** AI 完了 or skip 通知。aiQuestion=null = silent skip */
  onComplete: (aiQuestion: string | null, aiAnswer: string | null) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "answering"; question: string }
  | { kind: "skipped" };

export function AIQuestionStep({ bodySensationLabel, freeText, onComplete }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await generateFollowUpQuestion({ bodySensationLabel, freeText });
      if (cancelled) return;
      if ("error" in result) {
        setState({ kind: "skipped" });
        // 即時 silent skip 通知(skip 時は AI 質問なしで Q3 へ)
        onComplete(null, null);
      } else {
        setState({ kind: "answering", question: result.question });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bodySensationLabel, freeText, onComplete]);

  if (state.kind === "loading") {
    return (
      <div className="space-y-6 pt-4">
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-12 h-12 rounded-full bg-primary-500/30 animate-pulse" />
          <p className="text-sm text-neutral-500">ひと呼吸…</p>
        </div>
      </div>
    );
  }

  // state.kind === "skipped" の場合は onComplete で QuestionFlow が次 step に進む、
  // 本 component は unmount される。fallback render として何も出さない。
  if (state.kind === "skipped") {
    return null;
  }

  // state.kind === "answering"
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    if (state.kind === "answering") {
      onComplete(state.question, answer.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6 space-y-2">
        <p className="text-xs font-medium text-primary-700">AI からの問い</p>
        <p className="text-base text-neutral-800 leading-relaxed">
          {state.question}
        </p>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        placeholder="思ったままを書く"
        className="w-full rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-base leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
      />

      <button
        type="submit"
        disabled={!answer.trim() || submitting}
        className="w-full rounded-xl bg-primary-500 px-4 py-3.5 text-base font-medium text-neutral-50 shadow-sm transition hover:bg-primary-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        つぎへ
      </button>
    </form>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: build**

Run: `npm run build`
Expected: success(component 単体では import されていないので route 変化なし、次 task で QuestionFlow に統合)

- [ ] **Step 4: Commit**

```bash
git add app/today/_components/AIQuestionStep.tsx
git commit -m "feat: AIQuestionStep component (ADR-012 AI follow-up UI)

useEffect で generateFollowUpQuestion 呼び出し、loading / answering /
skipped の3 state。skipped は onComplete(null, null) で silent 通知、
QuestionFlow が次 step に進む。answering は highlighted card で AI 質問
表示 + textarea + 'つぎへ' button。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `QuestionFlow.tsx` に AI step 統合

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/QuestionFlow.tsx`

- [ ] **Step 1: import 追加 + state 追加**

`app/today/_components/QuestionFlow.tsx` の import 群に以下を追加(`MoonPhase` の下):

```typescript
import { AIQuestionStep } from "./AIQuestionStep";
import { BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
```

(`BODY_SENSATION_OPTIONS` が既に import されてれば skip)

- [ ] **Step 2: 関数本体に AI state を追加**

`QuestionFlow` 関数内、既存 state 宣言群(L23-36 あたり)の末尾に以下を追加:

```typescript
  // ADR-012 AI follow-up:Q2 完了後に AI step に入る、完了 or skip で Q3 へ
  type AIStatus = "pending" | "active" | "done" | "skipped";
  const initialAiStatus: AIStatus =
    initialEntry?.answers?.some((a) => a.question_position === 4)
      ? "done"
      : "pending";
  const [aiStatus, setAiStatus] = useState<AIStatus>(initialAiStatus);
  const [aiQuestion, setAiQuestion] = useState<string | null>(
    initialEntry?.answers?.find((a) => a.question_position === 4)
      ?.question_text ?? null,
  );
  const [aiAnswer, setAiAnswer] = useState<string>(
    initialEntry?.answers?.find((a) => a.question_position === 4)
      ?.value_text ?? "",
  );
```

(編集モード = `initialEntry` あり + pos 4 entry あり、の場合は AI step を skip する ─ 再生成しない、既存 AI 質問は edit 不可。本 task では「過去日編集で AI 質問の re-generate はしない」simple な挙動。後で要望あれば issue で追加。)

- [ ] **Step 3: handleSubmit に AI fields を追加**

既存 `handleSubmit` の `submitEntry({...})` 呼び出しに `aiQuestion` / `aiAnswer` を追加:

```typescript
      const result = await submitEntry({
        date,
        bodySensation,
        freeText: freeText.trim(),
        tomorrowMessage: tomorrowMessage.trim(),
        aiQuestion: aiQuestion ?? undefined,
        aiAnswer: aiAnswer.trim() ? aiAnswer.trim() : undefined,
      });
```

- [ ] **Step 4: AI step の進行ロジックを `next()` に追加**

既存 `next()` 関数(L41-46 あたり):

```typescript
  function next() {
    if (step < questions.length) {
      setStep(step + 1);
    }
  }
```

を以下に置換(Q2 → AI、AI 完了で Q3 へ):

```typescript
  function next() {
    // Q2 (step=1) 完了時、AI step が未到達なら AI に切替
    if (step === 1 && aiStatus === "pending") {
      setAiStatus("active");
      return;
    }
    // それ以外は通常通り次 step
    if (step < questions.length) {
      setStep(step + 1);
    }
  }
```

`back()` の挙動は変更なし(AI step から戻る動線はなし、AI 質問は1回だけ生成、戻るなら Q2 まで戻る = AI step を skip 状態にする ─ scope 外で v1.1 検討)。

- [ ] **Step 5: render 部分の分岐に AI step 追加**

既存 `isComplete = step >= questions.length` block の **直前**、`return (...)` の手前あたり、step 0/1/2 を render する block の前で、AI active を catch する分岐を追加:

`return (...)` の直前(`const q = questions[step];` の直後)に挿入:

```typescript
  // AI step が active のとき、Q1/Q2/Q3 ではなく AIQuestionStep を render
  if (aiStatus === "active") {
    const bodyLabel =
      BODY_SENSATION_OPTIONS.find((o) => o.value === bodySensation)?.label ??
      "";
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={back}
            className="text-neutral-500 disabled:invisible flex items-center gap-1"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <ProgressDots current={2} total={questions.length + 1} />
          <div className="w-5" />
        </div>

        <AIQuestionStep
          bodySensationLabel={bodyLabel}
          freeText={freeText.trim()}
          onComplete={(question, answer) => {
            setAiQuestion(question);
            setAiAnswer(answer ?? "");
            setAiStatus(question === null ? "skipped" : "done");
            setStep(2); // Q3 へ
          }}
        />
      </div>
    );
  }
```

(silent skip 時 = `aiStatus === "skipped"` で `setStep(2)` で Q3 へ進む、Q3 の prompt 上に「今夜は静かに進みます」を表示する必要あり、次 Step 6 で追加)

- [ ] **Step 6: Q3 step prompt に skipped 状態の 1 行を追加**

`questions[step]` を render する既存 block(`return (... step + 1 つめ ...)` のあたり、L122-180)を確認、Q3 step(step === 2)のとき + `aiStatus === "skipped"` のとき、`text-sm text-neutral-500` で 1 行追加:

step prompt の `<p className="text-sm text-neutral-500">{step + 1}つめ</p>` の上または下に以下を追加(条件付き):

```tsx
        <div className="space-y-2">
          {step === 2 && aiStatus === "skipped" && (
            <p className="text-xs text-neutral-500">今夜は静かに進みます</p>
          )}
          <p className="text-sm text-neutral-500">{step + 1}つめ</p>
          <h2 className="text-xl font-medium text-neutral-900 leading-relaxed">
            {q.text}
          </h2>
        </div>
```

(既存の `space-y-2` block 内に挿入、ProgressDots は引き続き 3 step ベース表示 = AI step は dots に含めない、UI 設計判断)

- [ ] **Step 7: typecheck**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 8: build**

Run: `npm run build`
Expected: success

- [ ] **Step 9: Commit**

```bash
git add app/today/_components/QuestionFlow.tsx
git commit -m "feat: QuestionFlow integrates AI follow-up step (ADR-012)

Q2 完了で aiStatus=active → AIQuestionStep render → onComplete で Q3 へ。
silent skip 時は Q3 prompt 上に '今夜は静かに進みます' 1 行表示。
ProgressDots は 3 step 維持(AI step は count しない、UI 設計判断)。
過去日編集モード(initialEntry に pos 4 あり)は AI step skip、再生成なし。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: SPEC.md AI セクション update

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/docs/SPEC.md`

- [ ] **Step 1: SPEC.md の AI 関連箇所を確認**

Run: `grep -n "Claude\|Anthropic\|AI follow-up\|monthly report" docs/SPEC.md | head -20`

- [ ] **Step 2: SPEC.md の AI セクションを update**

該当箇所:
- AI follow-up question の section(§3 内、ADR-012 言及)
- 月次レポートの section(§9、ADR-016 違反 flag つき)

主な更新内容:
1. AI provider = Gemini 2.0 Flash 明記(ADR-021 参照)
2. AI follow-up の data flow を本 spec(`docs/specs/2026-05-18-ai-followup-question-design.md`)準拠で書き換え
3. error handling = silent skip + retry 1 を明記
4. pos 4 + `answers.question_text` の使い方を schema 説明に追加
5. 月次レポート section は「ADR-016 準拠で再設計、`lib/ai/` 抽象化を再利用」と note

具体的編集は SPEC.md の現状構造に合わせる(本 plan では 4-5 箇所程度の自然な書き換えを想定、spec-keeper agent に dispatch するのが望ましい)。

**実装者は spec-keeper agent に dispatch すること**(SPEC.md は技術仕様の canonical source、worldview-keeper/adr-keeper と同じ owner-managed カテゴリ:CLAUDE.md `Files NOT to edit directly`)。

dispatch prompt(参考):
```
docs/SPEC.md の AI 関連セクションを以下方針で更新してください:

- AI provider = Gemini 2.0 Flash (ADR-021) を明記
- AI follow-up question の挙動(blocking await Q2→AI→Q3、retry 1+ silent skip、quote-back style)を docs/specs/2026-05-18-ai-followup-question-design.md 準拠で書き換え
- DB schema 説明に pos 4 + answers.question_text の使い方を追加
- 月次レポート section は「ADR-016 準拠で再設計、lib/ai/ 抽象化を再利用」と note

既存セクション構造を維持、追記ではなく既存記述の書き換え。完了後 commit メッセージ `docs(spec): AI セクション update (Gemini + follow-up flow)`、Co-Authored-By trailer 含む。
```

- [ ] **Step 3: spec-keeper の commit 確認**

Run: `git log --oneline HEAD~1..HEAD`
Expected: `docs(spec): ...` commit が直前にある

---

## Task 11: 手動 smoke test (dev サーバー)

**Files:** なし(動作確認のみ)

- [ ] **Step 1: dev サーバー起動**

Run: `npm run dev`
Expected: `Ready in 〜ms` 表示

- [ ] **Step 2: `.env.local` に GEMINI_API_KEY 設定確認**

```bash
grep GEMINI_API_KEY .env.local
```

Expected: `GEMINI_API_KEY=AIzaSy...` が設定されてる。なければ https://aistudio.google.com/apikey で取得して設定。

- [ ] **Step 3: 今日 entry の AI step 動作確認**

1. http://localhost:3000/today を開く
2. Q1 で phase タップ(例:3 ふつう)
3. Q2 自由記述に「会議で〇〇さんに、ふと言われた一言が引っかかってる。」と入力 → つぎへ
4. **AI step が render される**:
   - [ ] loading state「ひと呼吸…」が 1-3 秒表示
   - [ ] AI 質問が card で表示される、引用「...」含む(ADR-016 遵守)
   - [ ] textarea + 「つぎへ」 button 表示
5. AI 質問に回答入力 → つぎへ
6. Q3 step に進む → 入力 → 確認画面 → 保存する
7. /today/done に着地、bloom 演出
8. /calendar/[今日] で見ると、AI 質問 + 回答が pos 4 に保存されてる(detail mode は pos 4 を未表示、それは別 sub-task で対応)

- [ ] **Step 4: 失敗 fallback 動作確認**

`.env.local` の `GEMINI_API_KEY` を一時的に無効化(`GEMINI_API_KEY=invalid` 等)→ dev サーバー restart → /today で submit:
   - [ ] loading 1-3 秒
   - [ ] retry 1 回、それでも fail → 自動的に Q3 step へ
   - [ ] Q3 prompt 上に「今夜は静かに進みます」1 行表示
   - [ ] Q3 → 通常 submit → /today/done

確認後 `.env.local` を正しい key に戻す + dev サーバー restart。

- [ ] **Step 5: 過去日編集モードの skip 動作確認**

1. /calendar/[過去日(既に entry あり)] → 「書き直す」tap → mode C
2. 既存 entry に pos 4 あれば、編集モードでは AI step skip(Q2 → 直接 Q3)
3. pos 4 なければ(Phase 0 entries はこちら)、編集モードでも新規 AI 生成 → 動作

- [ ] **Step 6: dev サーバー停止**

`Ctrl+C` で停止

---

## Task 12: NEXT-ACTIONS マーク + main push + Vercel 再 deploy

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/docs/NEXT-ACTIONS.md`
- 環境設定:Vercel の本番 env vars に `GEMINI_API_KEY` を追加(user 操作)

- [ ] **Step 1: NEXT-ACTIONS で「AI follow-up question 実装」を closed に**

`docs/NEXT-ACTIONS.md` の 🌓 v1.0 セクション内、`- [ ] **AI follow-up question** 実装` の行を以下に置換:

```markdown
- [x] ~~**AI follow-up question** 実装~~ **2026-05-18 完了** ─ Gemini 2.0 Flash (ADR-021)、quote-back style (ADR-016)、blocking await + silent skip fallback。spec: `docs/specs/2026-05-18-ai-followup-question-design.md`、plan: `docs/plans/2026-05-18-ai-followup-question.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/NEXT-ACTIONS.md
git commit -m "docs: mark AI follow-up question 実装完了 in NEXT-ACTIONS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Vercel 本番 env に GEMINI_API_KEY 追加(user 認可要)**

Run:

```bash
printf "$GEMINI_API_KEY_LOCAL" | vercel env add GEMINI_API_KEY production --force
```

(or `.env.local` から手動コピーして `vercel env add` を interactive で実行)

確認:

```bash
vercel env ls production | grep GEMINI
```

Expected: `GEMINI_API_KEY  Encrypted  Production` の行表示

- [ ] **Step 4: main への push(user 認可要)**

```bash
git push origin main
```

main 直 push は autonomy mode classifier が block するので、user に明示認可を依頼してから実行。

- [ ] **Step 5: Vercel 本番 再 deploy(user 認可要)**

```bash
vercel --prod --yes
```

production の新 deploy URL を確認、`https://hoshifumi.vercel.app` で AI follow-up が動くか実機確認(Task 11 を本番で再現)。
