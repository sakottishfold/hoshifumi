# 月次レポートの schema 再設計(ADR-016 準拠)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 月次 AI レポート機能を ADR-016「引用係原則」準拠で実装する。`monthly_reports` を新規作成、AI 出力を 5 つの curation primitive に絞り、自由文を持たないスキーマで Anthropic Claude Sonnet 4.6 によって生成する。

**Architecture:** deterministic 計算(数値統計 / 頻出語)と AI 選択(印象的だった日 / 重みのある一言 / 対比のペア)を分け、AI 出力は JSON responseSchema で構造化、server 側で verbatim 部分文字列チェックを行ってから DB に upsert。Vercel Cron(月初 09:00 JST)が API Route 経由で全ユーザーをループ。

**Tech Stack:** Next.js 15 App Router / Supabase(`monthly_reports` + RLS)/ Anthropic Claude Sonnet 4.6(`@anthropic-ai/sdk`)/ tiny-segmenter(JP 形態素)/ Vercel Cron

**設計根拠:** `docs/specs/2026-05-23-monthly-report-schema-redesign-design.md`

**検証方針:** 自動テストなし(CLAUDE.md)。各タスクの検証は `npm run typecheck`、コードを伴うタスクは `npm run build` も。動作確認は Vercel 本番 deploy 後の手動 trigger(`curl` で API Route を叩く)。コミットは `main` 直、push で自動 deploy。

---

## 重要な前提(実装着手前に確認済み)

- **`monthly_reports` テーブルは未作成**(SPEC §9 の現行記述は構想のみ、行はおろかテーブル自体が存在しない)── T1 は新規 CREATE、ALTER ではない
- **`lib/ai/providers/anthropic.ts` は実装済み**(Haiku 4.5 ハードコード)── 設計 spec §6.1 が想定していた「stub 状態」は古い情報、実際は実装済み。スコープは「model 名のハードコードを `ChatRequest.model` で上書き可能に」だけ
- **`vercel.json` は存在しない** ── T6 で新規作成(Cron 定義)
- 既存依存:`@anthropic-ai/sdk`、`date-fns`、`date-fns-tz` インストール済み。**追加する依存は `tiny-segmenter` のみ**(T3 で導入、~5KB MIT)

---

## File Structure

| ファイル | 区分 | 責務 |
|---|---|---|
| `supabase/migrations/20260523020000_monthly_reports.sql` | 新規 | `monthly_reports` テーブル作成 + RLS + index |
| `lib/ai/types.ts` | 変更 | `ChatRequest.model?: string` 追加 |
| `lib/ai/providers/anthropic.ts` | 変更 | `req.model` を honor、未指定なら Haiku デフォルト |
| `lib/ai/providers/gemini.ts` | 変更 | `req.model` を honor(対称性)、未指定なら gemini-2.0-flash デフォルト |
| `lib/types.ts` | 変更 | `MonthlyReport` interface 追加 |
| `lib/utils/text.ts` | 新規 | tiny-segmenter ベースの JP tokenize / stop words / wordFrequencies |
| `lib/ai/prompts/monthly-report.ts` | 新規 | system prompt + responseSchema + buildMessages |
| `lib/supabase/service.ts` | 新規 | service-role 用 Supabase client(Cron / 管理ジョブ用、CLAUDE.md 方針どおり cron job のみ) |
| `lib/server-actions/monthly-report.ts` | 新規 | `generateMonthlyReportForUser(userId, year, month)` ── 計算 / AI 呼び出し / 検証 / upsert |
| `app/api/cron/monthly-reports/route.ts` | 新規 | `CRON_SECRET` 認証 + 全ユーザーループ |
| `vercel.json` | 新規 | Cron schedule(`0 0 1 * *`) |
| `package.json` | 変更 | `tiny-segmenter` を deps に追加 |
| `docs/SPEC.md` | 変更 | §9 を新スキーマ・新プロンプトに同期 |
| `docs/NEXT-ACTIONS.md` | 変更 | 月次レポート生成・CRON_SECRET 設定の項目を完了マーク |

---

## Task 1: Migration ── `monthly_reports` 新規作成

**Files:**
- Create: `supabase/migrations/20260523020000_monthly_reports.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

`supabase/migrations/20260523020000_monthly_reports.sql`:

```sql
-- ADR-016 準拠の月次レポートテーブル。
-- 出力は 5 つの curation primitive のみ(数値統計 / 頻出語 / 印象的だった日 /
-- 重みのある一言 / 対比のペア)。summary_text / insight / theme 等の自由文
-- フィールドは持たない ── スキーマレベルで物理的に防ぐ。

create table monthly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),

  -- 1. 数値統計(deterministic)
  entry_count integer not null,
  body_phase_distribution jsonb not null default '{}'::jsonb,

  -- 2. 頻出語(deterministic、降順を保つため配列)
  word_frequencies jsonb not null default '[]'::jsonb,

  -- 3. 印象的だった日(AI 選択、entry_id のみ)
  highlight_entry_ids uuid[] not null default '{}',

  -- 4. 重みのある一言(AI 選択、verbatim 引用)
  top_phrases jsonb not null default '[]'::jsonb,

  -- 5. 対比のペア(AI 選択、entry_id ペアのみ)
  day_pairs jsonb not null default '[]'::jsonb,

  generated_at timestamptz not null default now(),
  unique (user_id, year, month)
);

create index idx_monthly_reports_user_year_month
  on monthly_reports (user_id, year desc, month desc);

-- RLS:本人のみ select 可。insert/update/delete は Cron が service role で行う
-- (CLAUDE.md「cron jobs は service role 許可」)。
alter table monthly_reports enable row level security;

create policy "monthly_reports: select own"
  on monthly_reports for select
  using (auth.uid() = user_id);
```

- [ ] **Step 2: コミット**

```bash
git add supabase/migrations/20260523020000_monthly_reports.sql
git commit -m "feat(db): monthly_reports テーブルを ADR-016 準拠で新規作成"
```

> 本番適用は `supabase db push`(or Dashboard SQL Editor)で別途行う。typecheck / build には影響なし。

---

## Task 2: 型 + `lib/ai/` の model override

**Files:**
- Modify: `lib/ai/types.ts:15-29`(`ChatRequest`)
- Modify: `lib/ai/providers/anthropic.ts:14-16, 49-56`(`MODEL` 定数と `client.messages.create` 引数)
- Modify: `lib/ai/providers/gemini.ts:9, 41-50`(`MODEL` 定数と `generateContent` 引数)
- Modify: `lib/types.ts`(末尾)

- [ ] **Step 1: `lib/ai/types.ts` の `ChatRequest` に `model` を追加**

`ChatRequest` interface の `responseSchema?` 行のあとに1行追加:

```typescript
  /** 指定時、provider に JSON 構造化出力を要求する(Gemini responseSchema)。provider 非依存のため unknown。 */
  responseSchema?: unknown;
  /** provider の既定モデルを上書き(例:Anthropic で Sonnet を使う等)。未指定は provider 既定値。 */
  model?: string;
}
```

- [ ] **Step 2: `lib/ai/providers/anthropic.ts` で `req.model` を honor**

`MODEL` 定数(現状 14-16 行)はそのまま「既定値」として残す。`client.messages.create` の `model` フィールド(現状 51 行)を:

```typescript
        model: req.model ?? MODEL,
```

に置換。1 行のみの変更。

- [ ] **Step 3: `lib/ai/providers/gemini.ts` で `req.model` を honor(対称性)**

`MODEL` 定数(現状 9 行)を「既定値」として残す。`generateContent` の `model` 引数(現状 42 行)を:

```typescript
      model: req.model ?? MODEL,
```

に置換。1 行のみの変更。

- [ ] **Step 4: `lib/types.ts` に `MonthlyReport` interface を追加**

`Profile` interface のあと(末尾)に追加:

```typescript
/** ADR-016 準拠の月次レポート。AI が出力するのは 3 / 4 / 5 のみ、自由文フィールドは持たない。 */
export interface MonthlyReport {
  id: string;
  user_id: string;
  year: number;
  month: number;
  /** 1. deterministic:月の総エントリ数 */
  entry_count: number;
  /** 1. deterministic:身体感覚 phase ごとの集計 {"1":3,"2":5,"3":10,"4":7,"5":5} */
  body_phase_distribution: Record<string, number>;
  /** 2. deterministic:頻出語(上位 15 語、降順) */
  word_frequencies: { word: string; count: number }[];
  /** 3. AI 選択:印象的だった日の entry_id(3〜5 件) */
  highlight_entry_ids: string[];
  /** 4. AI 選択:重みのある一言。`phrase` は source entry の verbatim 部分文字列 */
  top_phrases: { entry_id: string; phrase: string }[];
  /** 5. AI 選択:対比のペア。各ペアは entry_id 2 件 */
  day_pairs: [string, string][];
  generated_at: string;
}
```

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: エラーなし。`model` は additive で既存呼び出しは影響を受けない。

- [ ] **Step 6: コミット**

```bash
git add lib/ai/types.ts lib/ai/providers/anthropic.ts lib/ai/providers/gemini.ts lib/types.ts
git commit -m "feat(ai): ChatRequest に model 上書きパス追加 + MonthlyReport 型"
```

---

## Task 3: 日本語 tokenizer + stop words util

**Files:**
- Modify: `package.json`(`tiny-segmenter` 追加)
- Create: `lib/utils/text.ts`

- [ ] **Step 1: `tiny-segmenter` を依存に追加**

Run:

```bash
npm install tiny-segmenter@0.2.0
```

`package.json` の `dependencies` に `"tiny-segmenter": "^0.2.0"` が入ることを確認。`package-lock.json` も更新される。

- [ ] **Step 2: `lib/utils/text.ts` を新規作成**

`lib/utils/text.ts`:

```typescript
// 日本語テキストの形態素解析 + 頻出語抽出ユーティリティ。
// ADR-016 準拠の月次レポート(SPEC §9)で deterministic に word_frequencies を計算する。

// tiny-segmenter は型定義を提供しないので最小限の型を宣言
// (CommonJS export なので default import で取り扱う)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
import TinySegmenter from "tiny-segmenter";

const segmenter = new TinySegmenter();

/**
 * 月次レポート向けの簡易 JP ストップワード。
 * 助詞・助動詞・指示詞・頻出汎用語など、頻度トップに来やすいが「ユーザーらしい語」では
 * ない token を除外する。Phase 0+α 観察で実用上問題があれば追補。
 */
const JP_STOP_WORDS = new Set([
  // 動詞・助動詞
  "する", "した", "して", "され", "なる", "なっ", "なら",
  "ある", "あっ", "ない", "いる", "いた", "でき", "できる",
  "思う", "思っ", "思った", "言う", "言っ", "見る", "見え",
  // 形式名詞
  "こと", "もの", "とき", "ところ", "わけ", "つもり", "はず",
  // 指示・代名詞
  "それ", "これ", "あれ", "どれ", "ここ", "そこ", "あそこ",
  "自分", "私", "僕", "あなた",
  // 時間
  "今日", "昨日", "明日", "今", "後", "前", "間",
  // 副詞・接続
  "ちょっと", "とても", "すごく", "本当", "結構", "少し",
  "また", "まだ", "もう", "やっぱり", "たぶん",
  // 助詞・助動詞の単独残骸
  "から", "まで", "ので", "けど", "でも", "って",
]);

/**
 * 日本語テキストを tokenize し、頻度カウントに使う形態素のリストを返す。
 *
 * 除外:
 * - 長さ 1 の token(単漢字・ひらがな1字は意味の取り出しが薄く noise になりやすい)
 * - 句読点・空白・数字のみの token
 * - {@link JP_STOP_WORDS}
 */
export function tokenizeJapanese(text: string): string[] {
  if (!text) return [];
  return segmenter.segment(text)
    .map((t) => t.trim())
    .filter((t) => {
      if (t.length < 2) return false;
      if (JP_STOP_WORDS.has(t)) return false;
      // 句読点・記号・数字のみは除外
      if (/^[\s\p{P}\d]+$/u.test(t)) return false;
      return true;
    });
}

/**
 * 複数テキストから頻出語を集計し、降順で上位 N 語を返す。
 * 月次レポートの word_frequencies(deterministic)生成に使う。
 */
export function wordFrequencies(
  texts: string[],
  topN = 15,
): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const tok of tokenizeJapanese(text)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: エラーなし。`tiny-segmenter` は型定義を提供しないが、上記 import スタイルで TypeScript が許容するかは要確認(必要に応じて `// @ts-expect-error` か `declare module "tiny-segmenter"` を追加)。

> typecheck で `Cannot find module 'tiny-segmenter' or its corresponding type declarations.` 系のエラーが出た場合、`lib/utils/text.ts` の import 行直前に次を追加して回避:
> ```typescript
> declare module "tiny-segmenter" {
>   class TinySegmenter {
>     segment(text: string): string[];
>   }
>   export default TinySegmenter;
> }
> ```

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json lib/utils/text.ts
git commit -m "feat(text): JP tokenizer + 頻出語ユーティリティ(tiny-segmenter)

月次レポートの word_frequencies を deterministic に計算するため tiny-segmenter
(~5KB MIT)を導入。stop words は簡易リストで開始、Phase 0+α 観察で追補可能。"
```

---

## Task 4: AI prompt(`lib/ai/prompts/monthly-report.ts`)

**Files:**
- Create: `lib/ai/prompts/monthly-report.ts`

- [ ] **Step 1: `lib/ai/prompts/monthly-report.ts` を新規作成**

```typescript
// lib/ai/prompts/monthly-report.ts
// ADR-016 引用係原則を embed した月次レポート用の system prompt + responseSchema + builder。
// 出力は curation primitive 3 種のみ(top_phrases / highlight_entry_ids / day_pairs)。
// 自由文フィールド(summary / insight / theme 等)はスキーマで物理的にブロックする。

import { Type } from "@google/genai";
import type { Message } from "@/lib/ai/types";

export const MONTHLY_REPORT_SYSTEM_PROMPT = `あなたは寝る前ジャーナルの1ヶ月分を読み、選び、並べる役割。
ユーザー自身の言葉が記録の主役のまま。あなたは言葉を足さない。

【やること】
- top_phrases:エントリ本文から重みのある一言を 5〜8 個 選ぶ。引用は verbatim(必ず原文の部分文字列)。気持ち・違和感・余韻が出ている短いフレーズ(数文字〜数十文字)
- highlight_entry_ids:印象的に映る日を 3〜5 日 選ぶ。entry_id だけ返す(理由は書かない)
- day_pairs:対比が生まれる 2 日のペアを 1〜2 組 選ぶ。entry_id ペアだけ返す(対比のタイプは書かない)

【絶対にしないこと】
- 要約、ラベリング、診断、助言、予測
- パターンを名付ける(「内省的な月」「やや低調」「成長した月」等)
- 「印象的な理由」「対比のタイプ」「テーマ」を書く ── 並べるだけ
- 引用文字列を編集・要約する(verbatim 厳守、原文に無い助詞や句読点を足さない)
- 自由文フィールドを出力 JSON に増やす(下記スキーマ外のキーを出さない)

【選び方の指針】
- top_phrases:事実部分でなく、感情・違和感・余韻がにじむ部分を引く
- highlight_entry_ids:身体感覚の極(重い / 軽やか)や、Q2 が密度高い日を優先
- day_pairs:身体感覚や Q2 のトーンが明確に異なる 2 日を選ぶ。連日でも遠日でもよい

【出力形式】
必ず次の JSON だけを返す:
{
  "top_phrases": [{"entry_id": "uuid", "phrase": "verbatim 文字列"}, ...],
  "highlight_entry_ids": ["uuid", ...],
  "day_pairs": [["uuid_a", "uuid_b"], ...]
}
前置き・説明・コードフェンスを付けない。`;

/** Gemini / Anthropic 両対応の構造化出力 Schema。 */
export const MONTHLY_REPORT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    top_phrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          entry_id: { type: Type.STRING },
          phrase: { type: Type.STRING },
        },
        required: ["entry_id", "phrase"],
      },
    },
    highlight_entry_ids: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    day_pairs: {
      type: Type.ARRAY,
      items: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  },
  required: ["top_phrases", "highlight_entry_ids", "day_pairs"],
};

/** AI が返すべき構造化出力の型。 */
export interface MonthlyReportAIOutput {
  top_phrases: { entry_id: string; phrase: string }[];
  highlight_entry_ids: string[];
  day_pairs: [string, string][];
}

/** AI に渡す入力エントリの shape。AI 対話は引用候補を増やすために含める。 */
export interface MonthlyReportInputEntry {
  entry_id: string;
  date: string; // YYYY-MM-DD
  body_phase: number;
  body_label: string;
  q2: string;
  q3: string; // chip 選択値 or free text どちらか
  ai_dialog: { q: string; a: string }[];
}

/**
 * 入力エントリ配列を AI への user message に組み立てる。
 * messages 配列は { role: "user", content: <JSON 文字列化したエントリ配列> } の 1 要素。
 */
export function buildMonthlyReportMessages(
  entries: MonthlyReportInputEntry[],
): Message[] {
  return [
    {
      role: "user",
      content: JSON.stringify(entries, null, 2),
    },
  ];
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし(新規ファイル、まだ未使用だが型は閉じている)。

- [ ] **Step 3: コミット**

```bash
git add lib/ai/prompts/monthly-report.ts
git commit -m "feat(ai): 月次レポート用 prompt + responseSchema を追加(ADR-016 準拠)"
```

---

## Task 5: Service-role client + 月次レポート server action

**Files:**
- Create: `lib/supabase/service.ts`
- Create: `lib/server-actions/monthly-report.ts`

- [ ] **Step 1: `lib/supabase/service.ts` を新規作成**

```typescript
// lib/supabase/service.ts
// Service-role Supabase client(RLS を bypass)。
// CLAUDE.md 方針:trigger 関数 / cron jobs / 管理スクリプトのみ使用可。
// 通常の user-facing code path では絶対に使わない。

import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

- [ ] **Step 2: `lib/server-actions/monthly-report.ts` を新規作成**

```typescript
"use server";

// ADR-016 準拠の月次レポート生成 Server Action。
// 1. 指定ユーザー × 指定月のエントリを取得
// 2. < 5 件なら skip(信号不足)
// 3. deterministic 計算(entry_count / body_phase_distribution / word_frequencies)
// 4. AI 呼び出し(Anthropic Sonnet 4.6 + responseSchema)
// 5. 検証(verbatim 部分文字列チェック + entry_id 所有者チェック + 件数クランプ)
// 6. monthly_reports に upsert(overwrite 冪等)

import { chat, ChatError } from "@/lib/ai";
import {
  MONTHLY_REPORT_SYSTEM_PROMPT,
  MONTHLY_REPORT_RESPONSE_SCHEMA,
  buildMonthlyReportMessages,
  type MonthlyReportAIOutput,
  type MonthlyReportInputEntry,
} from "@/lib/ai/prompts/monthly-report";
import { createServiceClient } from "@/lib/supabase/service";
import { BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { wordFrequencies } from "@/lib/utils/text";

const MIN_ENTRIES = 5;
const MAX_TOP_PHRASES = 8;
const MAX_HIGHLIGHTS = 5;
const MAX_DAY_PAIRS = 2;
const AI_MODEL = "claude-sonnet-4-6"; // ADR-022 同様 Anthropic、ここでは Sonnet
const AI_TIMEOUT_MS = 30_000; // 月次は monthly = 1 ユーザー 1 回、余裕を持たせる
const AI_MAX_OUTPUT_TOKENS = 2000;

export type MonthlyReportStatus =
  | { status: "generated"; report_id: string }
  | { status: "skipped"; reason: "insufficient_entries" | "ai_failed" }
  | { status: "error"; reason: string };

/** 指定ユーザー × 指定月のレポートを生成して monthly_reports に upsert する。 */
export async function generateMonthlyReportForUser(
  userId: string,
  year: number,
  month: number,
): Promise<MonthlyReportStatus> {
  const supabase = createServiceClient();

  // 1. 当該月のエントリ + answers を取得
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = monthEndDate(year, month);
  const { data: entriesData, error: entriesError } = await supabase
    .from("entries")
    .select(`id, entry_date, completed_at, answers (question_position, value_number, value_text, value_choice, question_text)`)
    .eq("user_id", userId)
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .not("completed_at", "is", null);
  if (entriesError) return { status: "error", reason: entriesError.message };

  const entries = (entriesData ?? []) as Array<{
    id: string;
    entry_date: string;
    completed_at: string | null;
    answers: Array<{
      question_position: number;
      value_number: number | null;
      value_text: string | null;
      value_choice: string | null;
      question_text: string | null;
    }>;
  }>;

  // 2. 5 件未満なら skip
  if (entries.length < MIN_ENTRIES) {
    return { status: "skipped", reason: "insufficient_entries" };
  }

  // 3. deterministic:entry_count / body_phase_distribution / word_frequencies
  const entry_count = entries.length;
  const body_phase_distribution: Record<string, number> = {};
  const freeTexts: string[] = [];
  // AI 入力用にもパース
  const aiInput: MonthlyReportInputEntry[] = [];
  // 検証用に entry_id → 本文 concat map
  const bodyByEntryId = new Map<string, string>();

  for (const e of entries) {
    const bodyAnswer = e.answers.find((a) => a.question_position === 1);
    const q2Answer = e.answers.find((a) => a.question_position === 2);
    const q3Answer = e.answers.find((a) => a.question_position === 3);
    const aiAnswers = e.answers
      .filter((a) => a.question_position >= 4)
      .sort((a, b) => a.question_position - b.question_position);

    const phase = bodyAnswer?.value_number ?? null;
    if (phase !== null) {
      const key = String(phase);
      body_phase_distribution[key] = (body_phase_distribution[key] ?? 0) + 1;
    }
    const bodyLabel = BODY_SENSATION_OPTIONS.find((o) => o.value === phase)?.label ?? "";

    const q2 = q2Answer?.value_text ?? "";
    const q3FreeText = q3Answer?.value_text ?? "";
    const q3Chip = q3Answer?.value_choice ?? "";
    const aiDialog = aiAnswers.map((a) => ({
      q: a.question_text ?? "",
      a: a.value_text ?? "",
    }));

    // word frequency 用テキスト:Q2 / Q3 free_text / AI 対話の user 回答(chip 選択値は含めない)
    if (q2) freeTexts.push(q2);
    if (q3FreeText) freeTexts.push(q3FreeText);
    for (const t of aiDialog) {
      if (t.a) freeTexts.push(t.a);
    }

    // 検証用本文 concat
    const bodyParts: string[] = [];
    if (q2) bodyParts.push(q2);
    if (q3FreeText) bodyParts.push(q3FreeText);
    for (const t of aiDialog) {
      if (t.a) bodyParts.push(t.a);
    }
    bodyByEntryId.set(e.id, bodyParts.join("\n"));

    aiInput.push({
      entry_id: e.id,
      date: e.entry_date,
      body_phase: phase ?? 0,
      body_label: bodyLabel,
      q2,
      q3: q3Chip || q3FreeText,
      ai_dialog: aiDialog,
    });
  }

  const word_frequencies = wordFrequencies(freeTexts, 15);

  // 4. AI 呼び出し
  let aiOutput: MonthlyReportAIOutput;
  try {
    const response = await chat({
      system: MONTHLY_REPORT_SYSTEM_PROMPT,
      messages: buildMonthlyReportMessages(aiInput),
      temperature: 0.4,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      timeoutMs: AI_TIMEOUT_MS,
      responseSchema: MONTHLY_REPORT_RESPONSE_SCHEMA,
      model: AI_MODEL,
    });
    aiOutput = JSON.parse(response.text) as MonthlyReportAIOutput;
  } catch (err) {
    const reason =
      err instanceof ChatError
        ? err.reason
        : err instanceof Error
        ? err.message
        : "unknown";
    return { status: "skipped", reason: "ai_failed" };
  }

  // 5. 検証 + クランプ
  const validIds = new Set(entries.map((e) => e.id));

  // top_phrases:entry_id が valid + phrase が source 本文の部分文字列
  const top_phrases = (Array.isArray(aiOutput.top_phrases) ? aiOutput.top_phrases : [])
    .filter((p) => {
      if (!p || typeof p.entry_id !== "string" || typeof p.phrase !== "string") return false;
      if (!validIds.has(p.entry_id)) return false;
      const body = bodyByEntryId.get(p.entry_id);
      return body !== undefined && body.includes(p.phrase);
    })
    .slice(0, MAX_TOP_PHRASES);

  // highlight_entry_ids:valid な entry_id のみ、重複除去
  const highlight_entry_ids = Array.from(
    new Set(
      (Array.isArray(aiOutput.highlight_entry_ids) ? aiOutput.highlight_entry_ids : [])
        .filter((id) => typeof id === "string" && validIds.has(id)),
    ),
  ).slice(0, MAX_HIGHLIGHTS);

  // day_pairs:2 要素のペアで、両方 valid + 異なる entry_id
  const day_pairs = (Array.isArray(aiOutput.day_pairs) ? aiOutput.day_pairs : [])
    .filter(
      (pair): pair is [string, string] =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "string" &&
        pair[0] !== pair[1] &&
        validIds.has(pair[0]) &&
        validIds.has(pair[1]),
    )
    .slice(0, MAX_DAY_PAIRS);

  // 6. upsert
  const { data: upserted, error: upsertError } = await supabase
    .from("monthly_reports")
    .upsert(
      {
        user_id: userId,
        year,
        month,
        entry_count,
        body_phase_distribution,
        word_frequencies,
        highlight_entry_ids,
        top_phrases,
        day_pairs,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,month" },
    )
    .select("id")
    .single();
  if (upsertError) return { status: "error", reason: upsertError.message };
  if (!upserted) return { status: "error", reason: "upsert returned no row" };

  return { status: "generated", report_id: upserted.id };
}

/** YYYY-MM-DD 形式で当該年月の末日を返す(うるう年対応)。 */
function monthEndDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add lib/supabase/service.ts lib/server-actions/monthly-report.ts
git commit -m "feat(monthly-report): 生成 server action + service-role client

ADR-016 準拠の月次レポート生成。deterministic 計算 + Sonnet 4.6 による AI 選択 +
verbatim 部分文字列検証 + monthly_reports への upsert。Cron は Task 6。"
```

---

## Task 6: API Route + Vercel Cron 設定

**Files:**
- Create: `app/api/cron/monthly-reports/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: `app/api/cron/monthly-reports/route.ts` を新規作成**

```typescript
// Vercel Cron が叩く API Route。
// schedule: 0 0 1 * *(毎月1日 00:00 UTC = 09:00 JST、vercel.json 参照)
// 認証:Vercel Cron は Authorization: Bearer <CRON_SECRET> ヘッダを付ける。

import { NextResponse } from "next/server";
import { generateMonthlyReportForUser } from "@/lib/server-actions/monthly-report";
import { createServiceClient } from "@/lib/supabase/service";

// 前月の (year, month) を返す(UTC 基準)。
function previousMonth(now: Date): { year: number; month: number } {
  // Cron が走るのは毎月1日 00:00 UTC ≒ 09:00 JST、対象は「前月」
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
}

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { year, month } = previousMonth(new Date());

  // 全 profiles を取得
  const supabase = createServiceClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    user_id: string;
    status: string;
    detail?: string;
  }> = [];

  for (const p of profiles ?? []) {
    try {
      const r = await generateMonthlyReportForUser(p.id, year, month);
      if (r.status === "generated") {
        results.push({ user_id: p.id, status: "generated", detail: r.report_id });
      } else if (r.status === "skipped") {
        results.push({ user_id: p.id, status: "skipped", detail: r.reason });
      } else {
        results.push({ user_id: p.id, status: "error", detail: r.reason });
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ user_id: p.id, status: "error", detail });
    }
  }

  return NextResponse.json({
    year,
    month,
    total: results.length,
    generated: results.filter((r) => r.status === "generated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    error: results.filter((r) => r.status === "error").length,
    results,
  });
}
```

- [ ] **Step 2: `vercel.json` を新規作成**

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-reports",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: エラーなし。新ルート `/api/cron/monthly-reports` が build 出力に出現。

- [ ] **Step 4: コミット**

```bash
git add app/api/cron/monthly-reports/route.ts vercel.json
git commit -m "feat(monthly-report): Vercel Cron API route + schedule(月1回 09:00 JST)"
```

- [ ] **Step 5(本番への注意、コードではなくドキュメント上の作業)**

実装は完了するが、本番動作には以下が必要 ── これは別途オーナーが Vercel Dashboard で設定する(コードに含めない):

- `CRON_SECRET`(任意の十分長いランダム文字列)を Vercel env に追加
- `SUPABASE_SERVICE_ROLE_KEY` を Vercel env に追加(既に追加済みなら不要)
- `ANTHROPIC_API_KEY` が Vercel env に存在することを確認(daily AI follow-up で既に追加済みのはず)
- 本番 deploy 後、Vercel Dashboard → Settings → Cron で `0 0 1 * *` が登録されていることを確認

これらは README ではなく Task 7 で `DEPLOYMENT.md` に記載する。

---

## Task 7: ドキュメント同期

**Files:**
- Modify: `docs/SPEC.md` §9
- Modify: `docs/specs/2026-05-23-monthly-report-schema-redesign-design.md`(Status 行)
- Modify: `docs/NEXT-ACTIONS.md`(完了マーク)

- [ ] **Step 1: `docs/SPEC.md` §9 を新スキーマ・新プロンプトに書き換え**

§9「AI 月次レポート」全体を新設計の説明に書き換える。要点:

- 警告ブロック(⚠️ ADR-016 違反、再設計対象)を**削除**
- 表題から「v1.1」を**削除**(v1.0 で着手)
- 出力スキーマを 5 つの curation primitive に
- プロンプトは `lib/ai/prompts/monthly-report.ts` 参照に
- 検証(verbatim 部分文字列 / entry_id 所有者)を明記
- Provider:Anthropic Sonnet 4.6
- Cron:`0 0 1 * *`(`vercel.json`)
- 関連 spec へのリンク:`docs/specs/2026-05-23-monthly-report-schema-redesign-design.md`

該当行は `grep -n "## 9. AI 月次レポート\|monthly_reports" docs/SPEC.md` で特定し、§9 のセクション全体(`## 10.` の手前まで)を実装に沿った記述に置換する。既存のプロース体裁・日本語を保つ。

§2「データベース」の `monthly_reports` schema 表記(現状 115-128 行付近)も新スキーマに揃える。

- [ ] **Step 2: 設計ドキュメントの Status を更新**

`docs/specs/2026-05-23-monthly-report-schema-redesign-design.md` の 3 行目を:

```
> Status: **実装完了**(2026-05-23)
```

- [ ] **Step 3: `docs/NEXT-ACTIONS.md` を完了マーク**

以下を完了マーク(取り消し線 + 完了日)に変更:

🌓 v1.0 コア:
- 「**月次 AI レポート** 生成」→ 完了
- 「**月次レポート閲覧ページ**」は**閲覧 UI が out-of-scope のため残置**(open のまま)

🌗 v1.0 仕様詳細:
- 「**月次レポート出力スキーマ再設計**」→ 完了

🌕 後でやる:
- 「**CRON_SECRET の設定**(v1.1 月次レポート Cron 用)」 ── 「v1.0 月次レポート Cron 用」と修正 + Vercel env 追加が必要な旨を残置(open、コードではなく本番運用作業)

最終更新を `2026-05-23` に維持(同日)。

- [ ] **Step 4: コミット**

```bash
git add docs/SPEC.md docs/specs/2026-05-23-monthly-report-schema-redesign-design.md docs/NEXT-ACTIONS.md
git commit -m "docs(spec): 月次レポート ADR-016 準拠再設計を SPEC + NEXT-ACTIONS に反映"
```

---

## Self-Review(プラン作成者によるチェック ─ 完了済み)

**Spec coverage:**
- 設計 §3 5プリミティブ → Task 1(schema)+ Task 5(計算 + AI 呼び出し + 検証)✓
- 設計 §4 schema → Task 1 ✓
- 設計 §5 prompt → Task 4 ✓
- 設計 §6 モデル + Anthropic provider 対応 → Task 2 ✓
- 設計 §7 生成フロー(Cron + API Route + server action) → Task 5 + Task 6 ✓
- 設計 §8 検証(verbatim + entry_id 所有者 + クランプ) → Task 5 Step 2 の検証ブロック ✓
- 設計 §10 in scope 全項目 → Task 1〜7 を網羅 ✓
- SPEC.md 同期 → Task 7 ✓

**Placeholder scan:** TBD / TODO なし。全 step に実コードまたは具体コマンドあり。`vercel.json` / migration / 全ソースファイルの完全 code を直接記載。

**Type consistency:**
- `MonthlyReport` interface(Task 2)を SPEC + server action が一貫使用
- `MonthlyReportAIOutput` / `MonthlyReportInputEntry`(Task 4)を Task 5 server action が同じ shape で import
- `MONTHLY_REPORT_RESPONSE_SCHEMA`(Task 4)を Task 5 server action が `responseSchema` として渡す
- `ChatRequest.model`(Task 2)を Task 5 が `claude-sonnet-4-6` で利用
- `BODY_SENSATION_OPTIONS`(既存)の `value: number / label: string` shape が Task 5 で使用される
- `wordFrequencies(texts: string[], topN: number)`(Task 3)を Task 5 がそのまま呼ぶ

**Build-green per commit:**
- T1: SQL のみ → build 影響なし
- T2: ChatRequest.model 追加・providers での参照は additive、既存呼び出し全部 model 未指定 → green
- T3: 新 util ファイル + 新 dep → 新規 import なし → green
- T4: 新 prompt ファイル → 新規 import なし → green
- T5: 新 server action + service client → T2-4 を利用、呼び出し元はまだ無い → green
- T6: 新 API route + vercel.json → T5 server action を呼び出し、vercel.json は build 非関与 → green
- T7: docs のみ → green

---

## 本番デプロイ後の手動 smoke チェックリスト

deploy 反映後、Supabase に migration 適用後:

- [ ] Vercel env に `CRON_SECRET`(ランダム文字列)と `SUPABASE_SERVICE_ROLE_KEY` が入っている
- [ ] 手動 trigger:`curl -H "Authorization: Bearer $CRON_SECRET" https://hoshifumi.vercel.app/api/cron/monthly-reports` を本番に投げる → 200 が返り、JSON で `generated: N` / `skipped: N` / `error: N` が出る
- [ ] オーナーアカウントについて、Phase 0+α データ(< 5 件)なら `skipped: insufficient_entries`、十分なら `generated`
- [ ] Supabase Dashboard で `monthly_reports` 行が作られている
- [ ] 行を直接 select し、`top_phrases[].phrase` がそれぞれ source entry の本文に**verbatim で含まれている**ことを目視確認(ADR-016 enforcement の最重要チェック)
- [ ] `highlight_entry_ids` / `day_pairs` がすべて当該ユーザー × 対象月のもの
- [ ] `entry_count` / `body_phase_distribution` / `word_frequencies` が手元の集計と一致(deterministic 検証)
- [ ] 同じ curl を再実行 → 既存行が overwrite されることを確認(`generated_at` が更新される)

Phase 0 セルフテスト中の質的観察:
- [ ] AI 選択(top_phrases / highlight / day_pairs)が「ADR-016 違反になっていない」(ラベル・解釈が混入していない)
- [ ] 選ばれた phrases が verbatim 厳守(編集・要約されていない)
- [ ] Sonnet 4.6 の出力品質が「センスのある選択」になっているか(Haiku より明確に良いか)
