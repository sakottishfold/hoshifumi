# 追加テンプレート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** basic + 仕事 / 子育て / つくる / 感謝 の計 5 テンプレートを追加、sticky last-used 選択で /today にテンプレ切替を載せる。

**Architecture:** `lib/constants/template.ts` を `TEMPLATES` record(5 種、TS 定数 + discriminated union)に再構成。`/today` は直近 entry の `template_name` を default、新規 `TemplateSwitcher` で step 0 切替。テンプレ間で変わるのは Q2 文言のみ、DB schema 変更なし。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript strict / Supabase Server Actions(既存)

**Spec reference:** `docs/specs/2026-05-21-additional-templates-design.md`

---

## File Structure

```
修正:
  lib/types.ts                                # TemplateName union、Template.displayName 追加
  lib/constants/template.ts                   # TEMPLATES record(5)+ getTemplate + TEMPLATE_LIST + buildQuestions
  lib/server-actions/entries.ts               # submitEntry に templateName param
  app/today/page.tsx                          # 直近 entry の template_name 取得 → QuestionFlow に渡す
  app/today/_components/QuestionFlow.tsx      # template state + TemplateSwitcher + getTemplate 連携
  app/calendar/[date]/page.tsx                # EntryDetail Q2 label を template 参照に

新規:
  app/today/_components/TemplateSwitcher.tsx  # inline 展開の picker

ドキュメント:
  docs/SPEC.md                                # テンプレ section update(spec-keeper dispatch)
  docs/NEXT-ACTIONS.md                        # 完了マーク
```

---

## Task 1: types.ts + template.ts(5 テンプレ定義)

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/types.ts`
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/constants/template.ts`(全面再構成)

### Step 1: lib/types.ts に TemplateName union + Template.displayName

`lib/types.ts` の既存 `Template` interface:

```typescript
export interface Template {
  name: string;
  emoji: string;
  description: string;
  questions: Question[];
}
```

を以下に置換(`TemplateName` union 追加、`name` narrow、`displayName` 追加):

```typescript
export type TemplateName =
  | "basic"
  | "work"
  | "parenting"
  | "making"
  | "gratitude";

export interface Template {
  name: TemplateName;
  /** UI 表示名(内部 name と分離)*/
  displayName: string;
  emoji: string;
  description: string;
  questions: Question[];
}
```

### Step 2: lib/constants/template.ts を全面再構成

`lib/constants/template.ts` の全内容を以下に置換:

```typescript
import type { Template, TemplateName, MoodOption, Question } from "@/lib/types";

// ADR-013: renamed from MOOD_OPTIONS. Q1 semantics shifted from "気分" to "いまの体の感じ".
// `emoji` carries the moon-phase unicode as data label; visual is <MoonPhase phase={value}/>.
export const BODY_SENSATION_OPTIONS: MoodOption[] = [
  { value: 1, emoji: "🌑", label: "重たい" },
  { value: 2, emoji: "🌒", label: "ざわざわ" },
  { value: 3, emoji: "🌓", label: "ふつう" },
  { value: 4, emoji: "🌔", label: "軽い" },
  { value: 5, emoji: "🌕", label: "軽やか" },
];

// ADR-023: Q3 chip options(全テンプレ共通)
const Q3_CHIPS = ["明日もがんばる", "ゆっくり眠る", "今日はここまで", "そのままで"];

// 全テンプレ共通の 3-beat ritual。Q2 の文言だけテンプレ別(spec: 追加テンプレート §3)。
// Q1 体感(ADR-013)・Q3 chip(ADR-023)は固定。
function buildQuestions(q2Text: string, q2Placeholder: string): Question[] {
  return [
    {
      position: 1,
      text: "いまの体の感じは?",
      input_type: "mood_5",
      options: BODY_SENSATION_OPTIONS,
    },
    {
      position: 2,
      text: q2Text,
      input_type: "free_text",
      placeholder: q2Placeholder,
    },
    {
      position: 3,
      text: "明日の自分にひとことだけ",
      // ADR-023: chip + text escape hybrid
      input_type: "chip_with_text",
      placeholder: "思ったままに",
      options: Q3_CHIPS,
    },
  ];
}

export const TEMPLATES: Record<TemplateName, Template> = {
  basic: {
    name: "basic",
    displayName: "ほしふみ",
    emoji: "🌒",
    description: "体・できごと・明日へ",
    questions: buildQuestions(
      "今日いちばん印象に残ったこと",
      "ひとことでも、ふたことでも",
    ),
  },
  work: {
    name: "work",
    displayName: "仕事",
    emoji: "🌒",
    description: "仕事の一日を置く",
    questions: buildQuestions(
      "今日の仕事で、心に残ったこと",
      "うまくいったことも、そうでないことも",
    ),
  },
  parenting: {
    name: "parenting",
    displayName: "子育て",
    emoji: "🌒",
    description: "子どもとの一日を置く",
    questions: buildQuestions(
      "今日の子どもとのこと",
      "小さなことでも",
    ),
  },
  making: {
    name: "making",
    displayName: "つくる",
    emoji: "🌒",
    description: "つくる一日を置く",
    questions: buildQuestions(
      "今日つくったもの、つくれなかったもの",
      "かたちにならなくても",
    ),
  },
  gratitude: {
    name: "gratitude",
    displayName: "感謝",
    emoji: "🌒",
    description: "ありがたみを置く",
    questions: buildQuestions(
      "今日、ありがたかったこと",
      "誰かのことでも、何かのことでも",
    ),
  },
};

// switcher の表示順
export const TEMPLATE_LIST: TemplateName[] = [
  "basic",
  "work",
  "parenting",
  "making",
  "gratitude",
];

/** template_name から Template を解決。不明 name は basic にフォールバック。*/
export function getTemplate(name: string): Template {
  return TEMPLATES[name as TemplateName] ?? TEMPLATES.basic;
}

// 後方互換:既存 import `BASIC_TEMPLATE` を使う箇所のため alias を残す。
// 新規コードは getTemplate() を使うこと。
export const BASIC_TEMPLATE = TEMPLATES.basic;
```

(`BASIC_TEMPLATE` alias を残すのは、QuestionFlow 等が現在 `import { BASIC_TEMPLATE }` しているため。Task 4 で QuestionFlow を `getTemplate` 経由に書き換える際にこの alias 依存を外す ─ ただし本 task 単体で build を通すため alias は残す)

### Step 3: typecheck

Run: `npm run typecheck`
Expected: エラーなし(`BASIC_TEMPLATE` alias で既存 import 互換、`emoji` 等 field も維持)

### Step 4: build

Run: `npm run build`
Expected: success

### Step 5: Commit

```bash
git add lib/types.ts lib/constants/template.ts
git commit -m "feat(template): 5 テンプレート定義(TEMPLATES record + getTemplate)

basic / work / parenting / making / gratitude。TemplateName union、
Template.displayName 追加、buildQuestions helper で 3-beat 共通化、
Q2 文言だけテンプレ別。BASIC_TEMPLATE は alias で後方互換維持。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: TemplateSwitcher.tsx 新規 component

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/TemplateSwitcher.tsx`

### Step 1: TemplateSwitcher component を作成

```typescript
"use client";

// 追加テンプレート spec §7.1。/today step 0 で current template を表示 + inline 展開で切替。
// state(open/closed)は component 内 local、選択は親(QuestionFlow)に onSelect 通知。

import { useState } from "react";
import { TEMPLATES, TEMPLATE_LIST } from "@/lib/constants/template";
import type { TemplateName } from "@/lib/types";

interface Props {
  current: TemplateName;
  onSelect: (name: TemplateName) => void;
}

export function TemplateSwitcher({ current, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
      >
        {TEMPLATES[current].displayName}
        <span className="text-neutral-400">▾</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-2 space-y-1">
      {TEMPLATE_LIST.map((name) => {
        const t = TEMPLATES[name];
        const isCurrent = name === current;
        return (
          <button
            key={name}
            type="button"
            onClick={() => {
              onSelect(name);
              setOpen(false);
            }}
            className={
              isCurrent
                ? "w-full flex items-center gap-3 rounded-xl bg-primary-50 px-3 py-2 text-left"
                : "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-neutral-100"
            }
          >
            <span className="text-base font-medium text-neutral-900 w-20 shrink-0">
              {t.displayName}
            </span>
            <span className="text-sm text-neutral-500 flex-1">
              {t.description}
            </span>
            {isCurrent && <span className="text-primary-600 text-sm">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
```

### Step 2: typecheck

Run: `npm run typecheck`
Expected: エラーなし

### Step 3: build

Run: `npm run build`
Expected: success(本 component は単体未 import、Task 4 で QuestionFlow から使われる)

### Step 4: Commit

```bash
git add app/today/_components/TemplateSwitcher.tsx
git commit -m "feat: TemplateSwitcher component (追加テンプレート §7.1)

collapsed = displayName + ▾ chip、expanded = TEMPLATE_LIST 5 行
(displayName + description + current ✓)。open 状態は local、選択は
onSelect で親通知。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: submitEntry に templateName param 追加

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/server-actions/entries.ts`

### Step 1: SubmitEntryInput に templateName 追加

`lib/server-actions/entries.ts` の `SubmitEntryInput` interface に `templateName` を追加。現状:

```typescript
interface SubmitEntryInput {
  date?: string;
  bodySensation: number; // 1-5, Q1 body sensation tap (was `mood` pre-ADR-013)
  freeText: string;
  // ADR-023: Q3 は chip(value_choice 行き)or text(value_text 行き)排他。
  /** Q3 chip 選択(chip mode 時)*/
  tomorrowChip?: string;
  /** Q3 自由記述(text escape mode 時)*/
  tomorrowMessage?: string;
  /** ADR-012 AI follow-up question(成功時のみ渡す、skip 時は undefined)*/
  aiQuestion?: string;
  /** ADR-012 AI follow-up に対する user の回答(aiQuestion と必ずセット)*/
  aiAnswer?: string;
}
```

の `date?: string;` の直下に1行追加:

```typescript
interface SubmitEntryInput {
  date?: string;
  /** 追加テンプレート: 使用したテンプレ。未指定は "basic" */
  templateName?: string;
  bodySensation: number; // 1-5, Q1 body sensation tap (was `mood` pre-ADR-013)
  freeText: string;
  // ADR-023: Q3 は chip(value_choice 行き)or text(value_text 行き)排他。
  /** Q3 chip 選択(chip mode 時)*/
  tomorrowChip?: string;
  /** Q3 自由記述(text escape mode 時)*/
  tomorrowMessage?: string;
  /** ADR-012 AI follow-up question(成功時のみ渡す、skip 時は undefined)*/
  aiQuestion?: string;
  /** ADR-012 AI follow-up に対する user の回答(aiQuestion と必ずセット)*/
  aiAnswer?: string;
}
```

### Step 2: entry upsert の template_name を input から取る

`submitEntry` 内の entry upsert(現状 `template_name: "basic"` hardcode):

```typescript
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: entryDate,
        template_name: "basic",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" },
    )
    .select()
    .single();
```

の `template_name: "basic",` を以下に置換:

```typescript
        template_name: input.templateName ?? "basic",
```

### Step 3: typecheck + build

Run: `npm run typecheck` ─ pass
Run: `npm run build` ─ pass

### Step 4: Commit

```bash
git add lib/server-actions/entries.ts
git commit -m "feat: submitEntry が templateName を受けて保存(追加テンプレート)

SubmitEntryInput に templateName optional 追加、entry upsert の
template_name hardcode 'basic' を input.templateName ?? 'basic' に。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: today/page.tsx + QuestionFlow.tsx(template 連携)

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/page.tsx`
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/QuestionFlow.tsx`

type 整合のため 2 file を **1 commit** にまとめる。

### Step 1: today/page.tsx で直近 entry の template_name 取得

`app/today/page.tsx` を読む。現状は `getEntryByDate(today)` で今日の entry を取り、`QuestionFlow` に `initialEntry` / `date` / `displayDate` を渡している。

`getEntriesForMonth` 等とは別に、直近完了 entry の template_name が必要。`lib/server-actions/entries.ts` に新ヘルパーを追加する ─ ただし本 task は QuestionFlow 連携が主眼なので、page.tsx 内で直接 supabase クエリせず、既存の `getEntryByDate` で取れる「今日の entry」があればその template_name、なければ別途「直近 entry」を引く。

**実装方針**:`lib/server-actions/entries.ts` に `getLastUsedTemplate()` server action を追加:

```typescript
/** 直近の完了 entry の template_name を返す。entry が無ければ "basic"。*/
export async function getLastUsedTemplate(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("entries")
    .select("template_name")
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("entry_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.template_name ?? "basic";
}
```

(この helper 追加も本 task の entries.ts 変更に含める ─ Task 3 と別 commit でも OK だが、本 task で page.tsx が使うので本 task に含める)

`app/today/page.tsx` を以下のように変更(現状を読んでから):
- `getLastUsedTemplate()` を import に追加
- 今日の entry があれば `entry.template_name`、なければ `await getLastUsedTemplate()` で `initialTemplateName` を決める
- `QuestionFlow` に `initialTemplateName` prop を追加で渡す

page.tsx の想定形(現状の page.tsx を読んで該当箇所に統合):

```typescript
import { todayJST, formatDisplay } from "@/lib/utils/date";
import { getEntryByDate, getLastUsedTemplate } from "@/lib/server-actions/entries";
import { QuestionFlow } from "./_components/QuestionFlow";
import { AppHeader } from "@/components/AppHeader";

export default async function TodayPage() {
  const today = todayJST();
  const entry = await getEntryByDate(today);
  const isCompleted = !!entry?.completed_at;

  // 追加テンプレート: 編集なら entry 自身の template、新規なら直近 entry の template(sticky last-used)
  const initialTemplateName = entry
    ? (entry.template_name ?? "basic")
    : await getLastUsedTemplate();

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-8 max-w-md mx-auto">
        <div className="mb-8 text-center">
          <p className="text-xs text-neutral-500">{formatDisplay(today)}</p>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1">
            {isCompleted ? "今日のほしふみ" : "今日のほしふみ、はじめよう"}
          </h1>
        </div>
        <QuestionFlow
          initialEntry={entry}
          date={today}
          displayDate={formatDisplay(today)}
          initialTemplateName={initialTemplateName}
        />
      </div>
    </main>
  );
}
```

(実際の page.tsx の現状を読み、import / JSX を上記方針に合わせて統合。`/calendar/[date]` 側も QuestionFlow を使うが、そちらは Task 4 末尾の注記参照)

### Step 2: QuestionFlow.tsx に template state + switcher

`app/today/_components/QuestionFlow.tsx` を読む。現状 `import { BASIC_TEMPLATE, BODY_SENSATION_OPTIONS } from "@/lib/constants/template"`、`const questions = BASIC_TEMPLATE.questions` で固定。

変更:

**(a) Props に initialTemplateName 追加**:

現状の Props interface:

```typescript
interface Props {
  initialEntry: EntryWithAnswers | null;
  date: string;
  displayDate: string;
}
```

を以下に:

```typescript
interface Props {
  initialEntry: EntryWithAnswers | null;
  date: string;
  displayDate: string;
  initialTemplateName: string;
}
```

**(b) import 変更 + template state**:

`import { BASIC_TEMPLATE, BODY_SENSATION_OPTIONS } from "@/lib/constants/template";` を以下に:

```typescript
import { getTemplate, BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { TemplateSwitcher } from "./TemplateSwitcher";
import type { TemplateName } from "@/lib/types";
```

関数 signature に `initialTemplateName` を追加:

```typescript
export function QuestionFlow({ initialEntry, date, displayDate, initialTemplateName }: Props) {
```

state 群の先頭付近(`useState(0)` の後あたり)に template state:

```typescript
  const [templateName, setTemplateName] = useState<TemplateName>(
    (initialTemplateName as TemplateName) ?? "basic",
  );
```

**(c) questions を getTemplate から**:

`const questions = BASIC_TEMPLATE.questions;` を以下に:

```typescript
  const questions = getTemplate(templateName).questions;
```

**(d) handleSubmit に templateName 追加**:

`submitEntry({...})` 呼び出しに `templateName` を追加(他 field はそのまま):

```typescript
      const result = await submitEntry({
        date,
        templateName,
        bodySensation,
        freeText: freeText.trim(),
        tomorrowChip: q3Mode === "chip" ? (tomorrowChip ?? undefined) : undefined,
        tomorrowMessage:
          q3Mode === "text" && tomorrowMessage.trim()
            ? tomorrowMessage.trim()
            : undefined,
        aiQuestion: aiQuestion ?? undefined,
        aiAnswer: aiAnswer.trim() ? aiAnswer.trim() : undefined,
      });
```

**(e) step 0 の render に TemplateSwitcher**:

通常 render(`return (<div className="space-y-8">...`)の step 0 部分、Q1 の上に TemplateSwitcher を出す。ただし **編集モード(`initialEntry` が non-null)では非表示**(編集は entry 固有 template、切替不可)。

既存の questions render block、`<div className="space-y-6 pt-4">` の中、`<div className="space-y-2">`(prompt)の **手前** に挿入:

```jsx
        {step === 0 && initialEntry === null && (
          <div>
            <TemplateSwitcher
              current={templateName}
              onSelect={setTemplateName}
            />
          </div>
        )}
```

(`initialEntry === null` = 新規 entry 時のみ switcher 表示。編集時は非表示)

### Step 3: typecheck

Run: `npm run typecheck`
Expected: エラーなし(page.tsx が `initialTemplateName` を渡し、QuestionFlow が受ける、型整合)

**注意**:`/calendar/[date]/page.tsx` も `QuestionFlow` を render している(mode C 編集)。`initialTemplateName` prop が必須になるので、calendar 側にも prop 追加が必要 ─ Task 5 で対応するが、本 Task 4 の typecheck を通すために **calendar 側にも最小限の prop 追加をこの Task で行う**:

`app/calendar/[date]/page.tsx` の `<QuestionFlow ... />` 呼び出しに以下を追加:

```jsx
            initialTemplateName={entry?.template_name ?? "basic"}
```

(編集モードは entry 固有 template、`entry` は mode C で必ず存在 ─ ただし型上 nullable なら `?? "basic"`)

### Step 4: build

Run: `npm run build`
Expected: success

### Step 5: Commit(page.tsx + QuestionFlow.tsx + entries.ts の getLastUsedTemplate + calendar prop)

```bash
git add app/today/page.tsx app/today/_components/QuestionFlow.tsx lib/server-actions/entries.ts app/calendar/[date]/page.tsx
git commit -m "feat: QuestionFlow が template 切替対応、sticky last-used (追加テンプレート)

getLastUsedTemplate server action 追加(直近完了 entry の template_name)。
today/page が初回テンプレを決めて QuestionFlow に渡す。QuestionFlow は
template state + step 0 に TemplateSwitcher(新規 entry のみ、編集時は非表示)、
getTemplate で questions 解決、handleSubmit で templateName 送信。
calendar/[date] の QuestionFlow 呼び出しにも initialTemplateName prop 追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: EntryDetail の Q2 label を template 参照に

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/calendar/[date]/page.tsx`(EntryDetail 関数)

### Step 1: EntryDetail で entry の template を解決、Q2 Section label に使う

`app/calendar/[date]/page.tsx` の `EntryDetail` 関数。現状 Q2 Section の label が hardcode「今日いちばん印象に残ったこと」。

`EntryDetail` 関数冒頭(`bodyAnswer` 等の find の近く)に template 解決を追加:

```typescript
  const template = getTemplate(entry.template_name ?? "basic");
  const q2Label = template.questions.find((q) => q.position === 2)?.text
    ?? "今日いちばん印象に残ったこと";
```

`getTemplate` を import に追加(`app/calendar/[date]/page.tsx` 先頭の import 群):

```typescript
import { getTemplate } from "@/lib/constants/template";
```

(既存に `BODY_SENSATION_OPTIONS` 等の template import があればそこに統合)

Q2 表示の `<Section label="今日いちばん印象に残ったこと">` を以下に:

```jsx
      <Section label={q2Label}>
```

(Q1「いまの体の感じ」・Q3「明日の自分にひとことだけ」・AI「AI からの問い」の label は全テンプレ共通なので hardcode のまま OK)

### Step 2: typecheck + build

Run: `npm run typecheck` ─ pass
Run: `npm run build` ─ pass、`/calendar/[date]` route ƒ 維持

### Step 3: Commit

```bash
git add app/calendar/[date]/page.tsx
git commit -m "feat: EntryDetail Q2 label を entry の template から (追加テンプレート)

仕事 entry を見ると Q2 Section label が「今日の仕事で、心に残ったこと」に。
getTemplate(entry.template_name) で解決、Q1/Q3/AI label は共通で hardcode 維持。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: SPEC.md テンプレ section update

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/docs/SPEC.md`

### Step 1: spec-keeper agent に dispatch

`docs/SPEC.md` の §3 テンプレート仕様セクションを更新。本 task は **spec-keeper agent に dispatch** すること(SPEC.md は技術仕様の canonical source)。

dispatch prompt(参考):
```
docs/SPEC.md の §3 テンプレート仕様セクションを更新してください:

- 現状「v0/current:Basic テンプレート」単体の記述を、5 テンプレート(basic / work /
  parenting / making / gratitude)体制に書き換え
- テンプレ間で変わるのは Q2 文言のみ(Q1 体感・Q3 chip 共通、3-beat 固定)を明記
- 選択方式 = sticky last-used(直近 entry の template_name を default、/today step 0 で切替)
- TS 定数(TEMPLATES record + getTemplate)、DB-backed は v1.1+ custom template まで作らない
  (CLAUDE.md 方針)を明記
- entries.template_name が per-entry 保存(既存 column、migration なし)
- 出典: docs/specs/2026-05-21-additional-templates-design.md

既存セクション構造維持、追記でなく書き換え主体。完了後 commit
`docs(spec): テンプレ section を 5 テンプレ体制に update`、Co-Authored-By trailer 付き。
```

### Step 2: spec-keeper の commit 確認

Run: `git log --oneline HEAD~1..HEAD`
Expected: `docs(spec): ...` commit

---

## Task 7: NEXT-ACTIONS マーク + push + Vercel deploy

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/docs/NEXT-ACTIONS.md`

### Step 1: NEXT-ACTIONS に「追加テンプレート 実装完了」を追記

`docs/NEXT-ACTIONS.md` の 🌓 v1.0 コア機能セクション、`- [ ] **追加テンプレート**...` の行を以下に置換(現状の行を grep で特定):

```markdown
- [x] ~~**追加テンプレート**(仕事 / 親 / クリエイター系)~~ **2026-05-21 完了** ─ basic + 仕事 / 子育て / つくる / 感謝 の 5 種、Q2 文言のみテンプレ別、sticky last-used 選択。spec: `docs/specs/2026-05-21-additional-templates-design.md`、plan: `docs/plans/2026-05-21-additional-templates.md`
```

### Step 2: Commit

```bash
git add docs/NEXT-ACTIONS.md
git commit -m "docs: mark 追加テンプレート 実装完了 in NEXT-ACTIONS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Step 3: main への push(user 認可要)

```bash
git push origin main
```

main 直 push は autonomy mode classifier が block するので、user に明示認可を依頼してから実行。

### Step 4: Vercel 本番 再 deploy(user 認可要)

```bash
vercel --prod --yes
```

deploy 後、`https://hoshifumi.vercel.app/today` で本番動作確認:
- /today で TemplateSwitcher 表示、5 テンプレ展開・切替
- テンプレ切替で Q2 文言変化
- 仕事テンプレで submit → 翌日 sticky last-used で 仕事 default
- /calendar/[テンプレ entry] で Q2 label がテンプレ別
- 既存 basic entries の regression なし

(dev サーバー手動 smoke は省略、本番で検証 ─ memory: skip-dev-smoke-verify-on-prod)
