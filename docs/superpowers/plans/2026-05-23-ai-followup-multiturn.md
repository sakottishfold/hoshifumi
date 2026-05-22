# AI Follow-up 深堀り(multi-turn)+ 質問品質改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI follow-up を「2レジスター対応の質問品質」+「適応的 multi-turn(最大3問)」へ改修し、AI 対話を確認画面・カレンダー詳細に表示する。

**Architecture:** AI は毎ターン構造化出力(JSON)で `ask`/`close` を返す。`lib/ai/` に responseSchema パスを追加。対話は `answers` の pos 4〜6 に保存(CHECK を `1..8` へ緩和)。`AIQuestionStep` をループ化、`generateFollowUpQuestion` を対話履歴ベースに変更。

**Tech Stack:** Next.js 15 App Router / React 19 / TypeScript strict / Supabase / `@google/genai`(Gemini 2.0 Flash)

**設計根拠:** `docs/specs/2026-05-23-ai-followup-multiturn-design.md`

**検証方針:** 本プロジェクトは自動テストなし(CLAUDE.md)。各タスクの検証は `npm run typecheck`、Task 3 以降は `npm run build` も。機能の動作確認は dev をスキップし Vercel 本番 deploy 後に手動 smoke(§最後のチェックリスト)。

---

## File Structure

| ファイル | 区分 | 責務 |
|---|---|---|
| `supabase/migrations/20260523000000_ai_multiturn.sql` | 新規 | `answers_question_position_check` を `1..8` へ |
| `lib/types.ts` | 変更 | `FollowUpTurn` 追加、`Answer.question_position` を `1..6` へ拡張 |
| `lib/ai/types.ts` | 変更 | `ChatRequest.responseSchema` 追加 |
| `lib/ai/providers/gemini.ts` | 変更 | responseSchema → JSON 出力強制 |
| `lib/ai/prompts/follow-up.ts` | 変更 | system prompt / few-shot 全面書き換え、multi-turn builder |
| `lib/server-actions/ai-followup.ts` | 変更 | `generateFollowUpQuestion` を対話履歴ベースへ、cap / graceful close |
| `app/today/_components/AIQuestionStep.tsx` | 変更 | multi-turn ループ化 |
| `app/today/_components/QuestionFlow.tsx` | 変更 | `aiTurns` state 化、確認カードに AI 対話ブロック |
| `lib/server-actions/entries.ts` | 変更 | `submitEntry` を `aiTurns[]` 受け取りへ、pos 4〜6 insert |
| `app/calendar/[date]/page.tsx` | 変更 | AI 対話の multi-turn 描画 |
| `docs/SPEC.md` | 変更 | §3 / §6 を multi-turn へ同期 |

---

## Task 1: DB マイグレーション(CHECK 制約緩和)

**Files:**
- Create: `supabase/migrations/20260523000000_ai_multiturn.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

`supabase/migrations/20260523000000_ai_multiturn.sql`:

```sql
-- ADR-024: AI follow-up multi-turn 化。
-- AI 対話ターンを answers の pos 4,5,6 に保存するため CHECK を緩める。
-- 既存制約は between 1 and 5(20260517000000_callback_state.sql)。
alter table answers
  drop constraint answers_question_position_check,
  add constraint answers_question_position_check
    check (question_position between 1 and 8);
```

- [ ] **Step 2: コミット**

```bash
git add supabase/migrations/20260523000000_ai_multiturn.sql
git commit -m "feat(db): answers.question_position の CHECK を 1..8 へ緩和(AI multi-turn)"
```

> 適用は deploy 手順(`docs/DEPLOYMENT.md`)で Supabase に対し実行される。typecheck / build は DB に触れないため本タスクで影響なし。

---

## Task 2: 共有型 + `lib/ai/` 構造化出力パス

**Files:**
- Modify: `lib/types.ts:50-60`
- Modify: `lib/ai/types.ts:15-28`
- Modify: `lib/ai/providers/gemini.ts:6-7, 41-50`

- [ ] **Step 1: `lib/types.ts` に `FollowUpTurn` を追加し `Answer.question_position` を拡張**

`lib/types.ts` の `Answer` interface(現状 50-60 行)を次へ置換:

```typescript
export interface Answer {
  id: string;
  entry_id: string;
  /** 1=body sensation, 2=event free text, 3=tomorrow message, 4-6=ADR-024 AI follow-up 対話ターン */
  question_position: 1 | 2 | 3 | 4 | 5 | 6;
  value_number: number | null;
  value_text: string | null;
  value_choice: string | null;
  /** ADR-012/024: AI 生成質問本文(question_position>=4 のときのみ非 null) */
  question_text: string | null;
}

/** ADR-024: AI follow-up 対話の1往復(問い + ユーザー回答)。 */
export interface FollowUpTurn {
  question: string;
  answer: string;
}
```

- [ ] **Step 2: `lib/ai/types.ts` の `ChatRequest` に `responseSchema` を追加**

`lib/ai/types.ts` の `ChatRequest` interface(現状 15-28 行)の `maxRetries` の下に1行追加:

```typescript
  /** retry 回数、default 1 */
  maxRetries?: number;
  /** 指定時、provider に JSON 構造化出力を要求する(Gemini responseSchema)。provider 非依存のため unknown。 */
  responseSchema?: unknown;
}
```

- [ ] **Step 3: `lib/ai/providers/gemini.ts` で responseSchema を Gemini に渡す**

import 行(現状 6 行目)に `Schema` を追加:

```typescript
import { ApiError, GoogleGenAI, type Schema } from "@google/genai";
```

`generateContent` 呼び出しの `config`(現状 44-49 行)を次へ置換:

```typescript
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxOutputTokens ?? 100,
        abortSignal: controller.signal,
        ...(req.responseSchema
          ? {
              responseMimeType: "application/json",
              responseSchema: req.responseSchema as Schema,
            }
          : {}),
      },
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: エラーなしで終了。`responseSchema` は additive・既存呼び出しは無変更のため green。

- [ ] **Step 5: コミット**

```bash
git add lib/types.ts lib/ai/types.ts lib/ai/providers/gemini.ts
git commit -m "feat(ai): 構造化出力(responseSchema)パスと FollowUpTurn 型を追加"
```

---

## Task 3: AI 対話レイヤの multi-turn 化(原子的リファクタ)

> このタスクは prompt → server action → UI step → QuestionFlow → submitEntry が型で連結しているため、5ファイルを1コミットで原子的に変更する。コミットは全 step 完了・typecheck green 後の1回のみ。

**Files:**
- Modify: `lib/ai/prompts/follow-up.ts`(全面書き換え)
- Modify: `lib/server-actions/ai-followup.ts`(全面書き換え)
- Modify: `app/today/_components/AIQuestionStep.tsx`(全面書き換え)
- Modify: `lib/server-actions/entries.ts:7, 9-24, 90-98`
- Modify: `app/today/_components/QuestionFlow.tsx:16, 58-96, 113-127, 152-195`

- [ ] **Step 1: `lib/ai/prompts/follow-up.ts` を全面書き換え**

ファイル全体を次へ置換:

```typescript
// lib/ai/prompts/follow-up.ts
// ADR-016 引用係原則 + ADR-024 multi-turn を embed した system prompt + few-shot + builder。
// 出力 = {"action":"ask","question":"..."} | {"action":"close"} の JSON。

import { Type } from "@google/genai";
import type { Message } from "@/lib/ai/types";
import type { FollowUpTurn } from "@/lib/types";

export const FOLLOW_UP_SYSTEM_PROMPT = `あなたは寝る前のジャーナリングを読み、書き手自身の言葉を引用して問い返す役割。
1問で終わることも、対話を2〜3往復することもある。

【引用と問いの作り方】
- 直近の記述(Q2、または直前の回答)から短いフレーズ(数文字〜十数文字)を1つ選び、引用形「...」で含める
- 選ぶのは「事実」部分ではなく、気持ち・違和感・余韻がにじむ部分
- 1〜2文の短い問い、句読点緩め

【良い問いとは】
- 答えると、書き手がまだ言葉にしていない何かに手が伸びる問い
- すでに書いてあることの確認ではない

【2つのレジスター】
- 重い日・ひっかかりのある日 → そのひっかかりを掘る
- 軽い日・短い日・気持ちが着地している日 → 掘らない。その良さに少し留まる問い、具体的な瞬間に向かう問い
- 掘る材料がない日に、無理にひっかかりを作らない

【続けるか、閉じるか】
毎回、それまでの対話全体を読んでから判断する:
- 続ける(ask) → 直前の回答が新しい含み・余白を開いていて、もう一歩で言葉になりそうなとき
- 閉じる(close) → 回答が短く閉じている / 気持ちが着地している / これ以上聞くと繰り返しになる / 軽い日でそもそも1問で十分なとき
- 迷ったら閉じる。問い詰めない。

【絶対にしないこと】
- 主語を聞き返す問い ──「〜と思ったのはあなた?」「〜と感じたのは?」(書き手は本人しかいない、聞く意味がない)
- はい/いいえだけで答えが済んでしまう問い
- すでに書いてある答えを、もう一度聞く問い
- いつ・どこで・誰と、といった事実を聞く問い
- 状態の要約・ラベリング・診断、「あなたは○○な人ですね」のような決めつけ
- アドバイス、励まし、共感の表明
- パターンの announce(「いつもこうですね」)
- 1回の出力に問いを2つ以上入れる

【トーン】
- 常体「〜?」「〜だね」(敬語禁止)
- 距離近め、ただし押し付けない
- 短い、空白に語らせる

【出力形式】
必ず次の JSON だけを返す:
- 続けるとき: {"action":"ask","question":"<引用を含む問い1つ>"}
- 閉じるとき: {"action":"close"}
前置き・説明・コードフェンスを付けない。`;

/** AI が返す構造化出力。 */
export type FollowUpAction =
  | { action: "ask"; question: string }
  | { action: "close" };

/** Gemini に渡す responseSchema(JSON 出力を強制)。 */
export const FOLLOW_UP_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["ask", "close"] },
    question: { type: Type.STRING },
  },
  required: ["action"],
};

export interface FollowUpInput {
  bodySensationLabel: string;
  freeText: string;
  /** これまでの AI 対話。初回呼び出しは空配列。 */
  dialog: FollowUpTurn[];
}

function buildInitialUserText(input: {
  bodySensationLabel: string;
  freeText: string;
}): string {
  return `Q1(体感):${input.bodySensationLabel}
Q2(今日のこと):${input.freeText}`;
}

/**
 * few-shot は user / model 交互の会話形式。model 側は出力形式どおり JSON 文字列。
 * 会話A=重い日・2往復して閉じる、B=軽い日・1問で閉じる、C=空の日・1問で閉じる。
 */
export const FOLLOW_UP_FEW_SHOTS: Message[] = [
  {
    role: "user",
    content: `Q1(体感):重たい
Q2(今日のこと):会議で〇〇さんに言われた一言が、まだ引っかかってる。`,
  },
  {
    role: "model",
    content: `{"action":"ask","question":"「一言が、まだ引っかかってる」って、その引っかかりはどこからきてる?"}`,
  },
  {
    role: "user",
    content: `自分でも気にしすぎだと思うけど、否定された気がした。`,
  },
  {
    role: "model",
    content: `{"action":"ask","question":"「否定された気がした」って、その感覚、もう少し聞かせて?"}`,
  },
  {
    role: "user",
    content: `たぶん、ちゃんとやってるって認めてほしかった。`,
  },
  { role: "model", content: `{"action":"close"}` },
  {
    role: "user",
    content: `Q1(体感):軽やか
Q2(今日のこと):おやすみだから最高。`,
  },
  {
    role: "model",
    content: `{"action":"ask","question":"「最高」って、今日のどのへんが一番そう?"}`,
  },
  { role: "user", content: `ふとんに入った瞬間。あったかくて。` },
  { role: "model", content: `{"action":"close"}` },
  {
    role: "user",
    content: `Q1(体感):ふつう
Q2(今日のこと):特に何もない、ふつうの一日だった。`,
  },
  {
    role: "model",
    content: `{"action":"ask","question":"「ふつうの一日」のなかで、ひとつだけ覚えてる小さなことは?"}`,
  },
  { role: "user", content: `帰り道の月がきれいだった。` },
  { role: "model", content: `{"action":"close"}` },
];

/**
 * few-shot + 初問 user message + これまでの対話履歴 を messages 配列に組み立てる。
 * dialog の各ターンは model(JSON)→ user(回答)の順で展開し、ライブ呼び出しと shape を揃える。
 */
export function buildFollowUpMessages(input: FollowUpInput): Message[] {
  const messages: Message[] = [
    ...FOLLOW_UP_FEW_SHOTS,
    {
      role: "user",
      content: buildInitialUserText(input),
    },
  ];
  for (const turn of input.dialog) {
    messages.push({
      role: "model",
      content: JSON.stringify({ action: "ask", question: turn.question }),
    });
    messages.push({ role: "user", content: turn.answer });
  }
  return messages;
}
```

- [ ] **Step 2: `lib/server-actions/ai-followup.ts` を全面書き換え**

ファイル全体を次へ置換:

```typescript
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
```

- [ ] **Step 3: `app/today/_components/AIQuestionStep.tsx` を全面書き換え**

ファイル全体を次へ置換:

```tsx
"use client";

// ADR-012/024 AI follow-up question UI(multi-turn)。
// QuestionFlow から Q2 完了後に render される。
// AI と最大3問の対話 → done で onComplete(turns) を呼ぶ。
// 初問失敗時は onComplete([]) で silent skip 通知。

import { useCallback, useEffect, useRef, useState } from "react";
import { generateFollowUpQuestion } from "@/lib/server-actions/ai-followup";
import type { FollowUpTurn } from "@/lib/types";

interface Props {
  bodySensationLabel: string;
  freeText: string;
  /** AI 対話完了通知。空配列 = silent skip。 */
  onComplete: (turns: FollowUpTurn[]) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "answering"; question: string }
  | { kind: "done" };

export function AIQuestionStep({
  bodySensationLabel,
  freeText,
  onComplete,
}: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 確定済みターン(re-render をまたいで保持)
  const turnsRef = useRef<FollowUpTurn[]>([]);
  // 初問取得の二重発火(StrictMode)対策
  const startedRef = useRef(false);

  // dialog 履歴を渡して次の outcome を取得し state を進める。
  const advance = useCallback(
    async (dialog: FollowUpTurn[]) => {
      setState({ kind: "loading" });
      const outcome = await generateFollowUpQuestion({
        bodySensationLabel,
        freeText,
        dialog,
      });
      if ("question" in outcome) {
        setSubmitting(false);
        setState({ kind: "answering", question: outcome.question });
      } else {
        // done または error(初問のみ)。done なら対話あり、error なら dialog は空。
        setState({ kind: "done" });
        onComplete(dialog);
      }
    },
    [bodySensationLabel, freeText, onComplete],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void advance([]);
  }, [advance]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!answer.trim() || submitting || state.kind !== "answering") return;
    setSubmitting(true);
    const nextTurns: FollowUpTurn[] = [
      ...turnsRef.current,
      { question: state.question, answer: answer.trim() },
    ];
    turnsRef.current = nextTurns;
    setAnswer("");
    void advance(nextTurns);
  }

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

  // done:onComplete 済み、QuestionFlow が次 step へ進め本 component は unmount。
  if (state.kind === "done") {
    return null;
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

- [ ] **Step 4: `lib/server-actions/entries.ts` を multi-turn 保存へ**

import 行(現状 7 行目)を次へ置換:

```typescript
import type { EntryWithAnswers, FollowUpTurn } from "@/lib/types";
```

`SubmitEntryInput` の AI 関連フィールド(現状 20-23 行)を次へ置換:

```typescript
  /** ADR-024 AI follow-up 対話(0件 = silent skip、最大3件)*/
  aiTurns?: FollowUpTurn[];
```

pos 4 保存ブロック(現状 90-98 行)を次へ置換:

```typescript
  // ADR-024: AI follow-up 対話を pos 4..6 に保存(silent skip 時は空配列 → insert なし)
  (input.aiTurns ?? []).forEach((turn, i) => {
    answers.push({
      entry_id: entry.id,
      question_position: 4 + i,
      question_text: turn.question,
      value_text: turn.answer,
    });
  });
```

- [ ] **Step 5: `app/today/_components/QuestionFlow.tsx` を multi-turn 対応へ**

import 行(現状 16 行目)を次へ置換:

```typescript
import type { MoodOption, EntryWithAnswers, TemplateName, FollowUpTurn } from "@/lib/types";
```

AI follow-up の state ブロック(現状 58-72 行 ── `type AIStatus` から `aiAnswer` の `useState` まで)を次へ置換:

```typescript
  // ADR-012/024 AI follow-up:Q2 完了後に AI step に入る、完了 or skip で Q3 へ
  type AIStatus = "pending" | "active" | "done" | "skipped";
  const initialAiTurns: FollowUpTurn[] =
    initialEntry?.answers
      ?.filter((a) => a.question_position >= 4)
      .sort((a, b) => a.question_position - b.question_position)
      .map((a) => ({
        question: a.question_text ?? "",
        answer: a.value_text ?? "",
      })) ?? [];
  const initialAiStatus: AIStatus =
    initialAiTurns.length > 0 ? "done" : "pending";
  const [aiStatus, setAiStatus] = useState<AIStatus>(initialAiStatus);
  const [aiTurns, setAiTurns] = useState<FollowUpTurn[]>(initialAiTurns);
```

`handleAIComplete`(現状 91-96 行)を次へ置換:

```typescript
  // ADR-024:AI step の完了 callback。turns 空 = silent skip。
  const handleAIComplete = useCallback((turns: FollowUpTurn[]) => {
    setAiTurns(turns);
    setAiStatus(turns.length === 0 ? "skipped" : "done");
    setStep(2); // Q3 へ
  }, []);
```

`submitEntry` 呼び出しの AI 引数(現状 125-126 行 ── `aiQuestion:` と `aiAnswer:` の2行)を次へ置換:

```typescript
        aiTurns,
```

確認カードの `space-y-3 text-sm` コンテナ内、「できごと」div(現状 164-169 行)と「明日へ」div(現状 170-175 行)の間に次のブロックを挿入:

```tsx
            {aiTurns.length > 0 && (
              <div className="flex gap-3">
                <span className="text-neutral-500 w-16">AIとの問い</span>
                <div className="flex-1 space-y-2">
                  {aiTurns.map((turn, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-neutral-500 leading-relaxed">
                        {turn.question}
                      </p>
                      <p className="text-neutral-800 leading-relaxed">
                        {turn.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: エラーなしで終了。`aiQuestion`/`aiAnswer` を全消費箇所で `aiTurns` に置換済み・`generateFollowUpQuestion` の新シグネチャに `AIQuestionStep` が追従済みのため green。

> 万一 `aiQuestion` / `aiAnswer` 残存エラーが出たら、`QuestionFlow.tsx` / `entries.ts` 内に置換漏れがある。`grep -rn "aiQuestion\|aiAnswer" lib app` で確認し本タスクの該当 step に従って修正。

- [ ] **Step 7: build**

Run: `npm run build`
Expected: 全ルート生成成功、エラーなし。

- [ ] **Step 8: コミット**

```bash
git add lib/ai/prompts/follow-up.ts lib/server-actions/ai-followup.ts \
  app/today/_components/AIQuestionStep.tsx lib/server-actions/entries.ts \
  app/today/_components/QuestionFlow.tsx
git commit -m "feat(ai): AI follow-up を multi-turn 化 + 質問品質改善(2レジスター)"
```

---

## Task 4: カレンダー詳細の multi-turn 表示

**Files:**
- Modify: `app/calendar/[date]/page.tsx:156, 197-213`

- [ ] **Step 1: `aiAnswer` の find を multi-turn filter へ**

`EntryDetail` 内(現状 156 行)を次へ置換:

```typescript
  const aiTurns = (entry.answers ?? [])
    .filter((a) => a.question_position >= 4)
    .sort((a, b) => a.question_position - b.question_position);
```

- [ ] **Step 2: 「AI からの問い」Section を対話ループ描画へ**

AI follow-up の Section(現状 197-213 行 ── コメント行から `)}` まで)を次へ置換:

```tsx
      {/* ADR-012/024: AI follow-up 対話(pos 4..6)。Phase 0 entries には無いので skip。 */}
      {aiTurns.length > 0 && (
        <Section label="AI からの問い">
          <div className="space-y-4">
            {aiTurns.map((turn) => (
              <div key={turn.question_position} className="space-y-1">
                {turn.question_text && (
                  <p className="text-sm text-neutral-500 leading-relaxed whitespace-pre-wrap">
                    {turn.question_text}
                  </p>
                )}
                {turn.value_text ? (
                  <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
                    {turn.value_text}
                  </p>
                ) : (
                  <p className="text-neutral-400">記録なし</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: いずれもエラーなし。single-turn 期の既存 entry は `filter(pos>=4)` が要素1配列を返し後方互換。

- [ ] **Step 4: コミット**

```bash
git add app/calendar/[date]/page.tsx
git commit -m "feat(calendar): エントリ詳細で AI 対話を multi-turn 表示"
```

---

## Task 5: ドキュメント同期

**Files:**
- Modify: `docs/SPEC.md`(§3 / §6 の AI follow-up 記述)
- Modify: `docs/specs/2026-05-23-ai-followup-multiturn-design.md`(Status 行)

- [ ] **Step 1: `docs/SPEC.md` を multi-turn へ同期**

`docs/SPEC.md` 内の AI follow-up 記述を実装に合わせて更新する。最低限の修正点:
- §3 リクエストフロー:`generateFollowUpQuestion` が single → multi-turn(最大3問、AI が ask/close を JSON で判断)になった旨。pos 4 単一 → pos 4〜6。
- §6 の Open Question「`/calendar/[date]` 詳細で pos 4 が表示されない」── 既に表示実装済み + 本改修で multi-turn 対応した旨に訂正。
- `answers.question_position` の CHECK を `BETWEEN 1 AND 4` 表記 → `BETWEEN 1 AND 8`(実 DB は元々 1..5、本改修で 1..8)。

該当箇所を探すコマンド:`grep -n "follow-up\|pos 4\|BETWEEN 1 AND" docs/SPEC.md`

- [ ] **Step 2: 設計ドキュメントの Status を更新**

`docs/specs/2026-05-23-ai-followup-multiturn-design.md` の 3 行目:

```
> Status: **実装完了**(2026-05-23)
```

- [ ] **Step 3: コミット**

```bash
git add docs/SPEC.md docs/specs/2026-05-23-ai-followup-multiturn-design.md
git commit -m "docs(spec): AI follow-up multi-turn 化を SPEC に反映"
```

- [ ] **Step 4: ADR-024 の diff をオーナーに提案(コミットしない)**

`docs/DECISIONS.md` はオーナー管理・直接編集禁止(CLAUDE.md)。ADR-024「AI follow-up を v1.0 で multi-turn 化(single-turn α 決定の前倒し)」の本文 diff をチャットで提案する。ADR-012 を supersede せず「single でスタート」部分のみ改定する旨を明記。先行 spec 2026-05-18 §1 の single-turn 決定を一部 supersede することにも触れる。

---

## Self-Review(プラン作成者によるチェック ─ 完了済み)

**Spec coverage:**
- #1 プロンプト改修 → Task 3 Step 1 ✓
- #2 multi-turn(適応的・cap 3・JSON)→ Task 3 Step 1-3(prompt / action / UI)✓
- #2 派生 構造化出力 → Task 2 ✓ / schema → Task 1 ✓
- #3 確認画面に AI 対話 → Task 3 Step 5(確認カードブロック)✓
- #4 カレンダー詳細 multi-turn → Task 4 ✓
- ADR-024 → Task 5 Step 4 ✓
- SPEC.md 同期 → Task 5 ✓

**Placeholder scan:** TBD / TODO なし。全 step に実コードまたは具体コマンドあり。

**Type consistency:** `FollowUpTurn`(lib/types.ts、Task 2)を ai-followup / entries / QuestionFlow / AIQuestionStep が一貫使用。`FollowUpInput`(`dialog: FollowUpTurn[]` 込み)を follow-up.ts で定義、ai-followup / AIQuestionStep が同じ shape で呼び出し。`FollowUpOutcome`(`{question}|{done}|{error}`)を AIQuestionStep が `"question" in outcome` で分岐。`generateFollowUpQuestion` の新シグネチャと全呼び出し元が一致。

---

## 本番デプロイ後の手動 smoke チェックリスト(設計 §12)

deploy 後、Vercel 本番で確認:

- [ ] 重い Q2 → 2〜3問の対話 → close → Q3 へ
- [ ] 軽い Q2(「おやすみだから最高。」)→ 1問で close、主語/詰問にならない(起点ケース回帰)
- [ ] 空の Q2(「ふつうの一日だった。」)→ 主語/事実/はい・いいえ質問が出ない
- [ ] 確認カードに AI 対話が全ターン表示される
- [ ] 保存後 `/calendar/[date]` で AI 対話が全ターン表示される
- [ ] 初問失敗(API key 未設定等)→ silent skip →「今夜は静かに進みます」→ Q3 通過
- [ ] cap:長い対話でも3問で必ず Q3 へ進む
- [ ] Phase 0 期の single-turn 既存 entry がカレンダーで壊れず表示される
