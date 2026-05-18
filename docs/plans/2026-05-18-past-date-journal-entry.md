# 過去日ジャーナル作成・編集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/calendar/[date]` を read-only から write-capable に拡張、過去日 / 今日いずれも entry の作成・編集ができる動線を追加する。

**Architecture:** 既存 `QuestionFlow` を再利用、`?edit=1` query param で同 page 内 mode 切替(空欄 / detail / 編集の3 mode)。QuestionFlow の handleSubmit 内で `date === todayJST()` 判定して redirect 先を分岐(今日→/today/done bloom 動線、過去→/calendar/[date] quiet 確認)。submitEntry に future date reject 追加、selectCallbackEntry の milestone 判定を `===` から `>=` に変更して遡及踏み越えを次の /today/done でキャッチアップ。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript strict / Supabase Server Actions / 既存 `QuestionFlow` コンポーネント

**Spec reference:** `docs/specs/2026-05-18-past-date-journal-entry-design.md`

---

## File Structure

```
修正:
  lib/server-actions/callback.ts        # selectCallbackEntry の unlock 判定 === → >=
  lib/server-actions/entries.ts         # submitEntry に future date reject 追加
  app/today/_components/QuestionFlow.tsx # handleSubmit redirect 分岐
  app/calendar/[date]/page.tsx          # read-only → 3 mode(空欄 / detail / 編集)、?edit=1 query
  issues/2026-05-18-past-date-journal-entry.md  # frontmatter status open → in-progress → closed
```

各ファイル単一責任維持:
- `callback.ts`:retroactive milestone catch-up の 1 行変更のみ
- `entries.ts`:future date validation 1 ブロック追加のみ、他処理 untouched
- `QuestionFlow.tsx`:redirect 分岐ロジック、UI 部分 untouched
- `calendar/[date]/page.tsx`:mode router + 3 mode rendering、QuestionFlow は外部参照

---

## Task 1: selectCallbackEntry の milestone 判定を `>=` に変更

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/server-actions/callback.ts:125`

- [ ] **Step 1: 該当行を `>=` に変更**

`lib/server-actions/callback.ts` 内の以下の行(STEP 4 内、`unlockingStage` の find):

```typescript
  const unlockingStage = STAGES.find(
    (s) => entryCount === s.unlockAt && s.stage > unlockedStage,
  );
```

を以下に置換:

```typescript
  const unlockingStage = STAGES.find(
    (s) => entryCount >= s.unlockAt && s.stage > unlockedStage,
  );
```

理由:遡及 entry が milestone を踏み越えた状態のとき、次の /today/done で Stage 1 deterministic 発火を catch-up。`s.stage > unlockedStage` の既存ガードにより 1 unlock につき 1 回しか fire しない、再発火 bug 出ない。

- [ ] **Step 2: typecheck で型整合確認**

Run: `npm run typecheck`
Expected: エラーなし(条件式の比較演算子変更のみ、型は同じ)

- [ ] **Step 3: build で server action として正しく compile**

Run: `npm run build`
Expected: success、10 routes 全生成

- [ ] **Step 4: Commit**

```bash
git add lib/server-actions/callback.ts
git commit -m "fix: selectCallbackEntry catches retroactive milestone crossings

issue #001 で過去日 entry が milestone (5/15/25/35) を踏み越えた状態のとき、
旧 === 判定では二度と発火しなかった。>= 判定 + 既存 s.stage > unlockedStage
ガードで、次 /today/done 訪問時に最低未消化 stage が deterministic 発火。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: submitEntry に future date reject 追加

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/server-actions/entries.ts:24-25`(entryDate 算出直後)

- [ ] **Step 1: future date validation を追加**

`lib/server-actions/entries.ts` の `submitEntry` 関数内、以下の行:

```typescript
  const entryDate = input.date ?? todayJST();

  // entry upsert
```

を以下に置換(空行の代わりに validation block を挿入):

```typescript
  const entryDate = input.date ?? todayJST();

  // ADR-008 worldview: 未来日への書き込みは禁止(issue #001)。
  // 過去・今日は許可(retroactive journal 作成・編集の対応)。
  if (entryDate > todayJST()) {
    throw new Error("未来日は書けません");
  }

  // entry upsert
```

文字列比較は YYYY-MM-DD format なので lexicographic 比較 = chronological 比較で正しい。

- [ ] **Step 2: typecheck で型整合確認**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: build**

Run: `npm run build`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add lib/server-actions/entries.ts
git commit -m "feat: submitEntry rejects future dates (issue #001)

過去・今日は許可(retroactive 対応)、未来は throw。YYYY-MM-DD 文字列比較で
判定。client の QuestionFlow の既存 error handling が拾う。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: QuestionFlow handleSubmit の redirect 分岐

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/QuestionFlow.tsx:1-12`(import 追加)
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/QuestionFlow.tsx:53-69`(handleSubmit 内)

- [ ] **Step 1: import 行に todayJST を追加**

`app/today/_components/QuestionFlow.tsx` の import 群、以下の行:

```typescript
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BASIC_TEMPLATE } from "@/lib/constants/template";
import { submitEntry } from "@/lib/server-actions/entries";
import { MoodInput } from "./MoodInput";
import { FreeTextInput } from "./FreeTextInput";
import { ProgressDots } from "./ProgressDots";
import { MoonPhase } from "@/components/MoonPhase";
import type { MoodOption, EntryWithAnswers } from "@/lib/types";
```

を以下に置換(`todayJST` を新規 import):

```typescript
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BASIC_TEMPLATE } from "@/lib/constants/template";
import { submitEntry } from "@/lib/server-actions/entries";
import { todayJST } from "@/lib/utils/date";
import { MoodInput } from "./MoodInput";
import { FreeTextInput } from "./FreeTextInput";
import { ProgressDots } from "./ProgressDots";
import { MoonPhase } from "@/components/MoonPhase";
import type { MoodOption, EntryWithAnswers } from "@/lib/types";
```

- [ ] **Step 2: handleSubmit 内の router.push を分岐**

同ファイルの `handleSubmit` 関数、以下の block:

```typescript
  function handleSubmit() {
    if (bodySensation === null || !freeText.trim() || !tomorrowMessage.trim()) return;

    startTransition(async () => {
      const result = await submitEntry({
        date,
        bodySensation,
        freeText: freeText.trim(),
        tomorrowMessage: tomorrowMessage.trim(),
      });
      if (result.success) {
        router.push(
          `/today/done?streak=${result.streak.streak_days}&phase=${result.bodyPhase}&total=${result.totalEntries}`,
        );
      }
    });
  }
```

を以下に置換(redirect target を date で分岐):

```typescript
  function handleSubmit() {
    if (bodySensation === null || !freeText.trim() || !tomorrowMessage.trim()) return;

    startTransition(async () => {
      const result = await submitEntry({
        date,
        bodySensation,
        freeText: freeText.trim(),
        tomorrowMessage: tomorrowMessage.trim(),
      });
      if (result.success) {
        // issue #001: 今日 submit は /today/done で bloom ceremony、
        // 過去 submit は /calendar/[date] で quiet 確認に分岐(spec §3.3)
        const target =
          date === todayJST()
            ? `/today/done?streak=${result.streak.streak_days}&phase=${result.bodyPhase}&total=${result.totalEntries}`
            : `/calendar/${date}`;
        router.push(target);
      }
    });
  }
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: エラーなし(`todayJST` は既存 export、QuestionFlow の `date` prop は string で既存通り)

- [ ] **Step 4: build**

Run: `npm run build`
Expected: success

- [ ] **Step 5: Commit**

```bash
git add app/today/_components/QuestionFlow.tsx
git commit -m "feat: QuestionFlow redirects past submit to /calendar/[date] (issue #001)

date === todayJST() のときは既存 /today/done(bloom + callback ceremony)、
それ以外は /calendar/[date] に着地して quiet confirm。
spec §3.3 mode 依存遷移の実装。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: /calendar/[date] page を 3 mode 化

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/calendar/[date]/page.tsx`(全体差し替え)

- [ ] **Step 1: page.tsx を 3 mode 対応版に置換**

`app/calendar/[date]/page.tsx` の全内容を以下に置換:

```typescript
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getEntryByDate } from "@/lib/server-actions/entries";
import { formatDisplay, todayJST } from "@/lib/utils/date";
import { BODY_SENSATION_OPTIONS } from "@/lib/constants/template";
import { AppHeader } from "@/components/AppHeader";
import { MoonPhase } from "@/components/MoonPhase";
import { QuestionFlow } from "@/app/today/_components/QuestionFlow";

interface Props {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export default async function EntryDetailPage({ params, searchParams }: Props) {
  const { date } = await params;
  const { edit } = await searchParams;

  // 簡易バリデーション (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const today = todayJST();
  const isFuture = date > today;
  const editing = edit === "1";

  // 未来日は読み書き両方 reject (spec §3.4)
  if (isFuture) {
    return (
      <main className="min-h-dvh">
        <AppHeader />
        <div className="px-6 py-6 max-w-md mx-auto">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            カレンダーへ戻る
          </Link>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-neutral-900">
              {formatDisplay(date)}
            </h1>
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-8 text-center">
              <p className="text-neutral-500">未来は書けません</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const entry = await getEntryByDate(date);

  // mode C: 編集モード (?edit=1)
  if (editing) {
    return (
      <main className="min-h-dvh">
        <AppHeader />
        <div className="px-6 py-8 max-w-md mx-auto">
          <Link
            href={`/calendar/${date}`}
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            やめる
          </Link>
          <div className="mb-8 text-center">
            <p className="text-xs text-neutral-500">{formatDisplay(date)}</p>
            <h1 className="text-2xl font-bold text-neutral-900 mt-1">
              {entry ? "ほしふみを書き直す" : "この日のほしふみ"}
            </h1>
          </div>
          <QuestionFlow
            initialEntry={entry}
            date={date}
            displayDate={formatDisplay(date)}
          />
        </div>
      </main>
    );
  }

  // mode A: 空欄
  if (!entry) {
    return (
      <main className="min-h-dvh">
        <AppHeader />
        <div className="px-6 py-6 max-w-md mx-auto">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            カレンダーへ戻る
          </Link>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-neutral-900">
              {formatDisplay(date)}
            </h1>
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-8 text-center space-y-4">
              <p className="text-neutral-500">この日の記録はありません</p>
              <Link
                href={`/calendar/${date}?edit=1`}
                className="inline-block rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary-600"
              >
                この日のほしふみを書く
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // mode B: 既存 entry あり、detail 表示
  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-6 max-w-md mx-auto">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          カレンダーへ戻る
        </Link>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-neutral-900">
            {formatDisplay(date)}
          </h1>
          <EntryDetail entry={entry} />
          <Link
            href={`/calendar/${date}?edit=1`}
            className="block w-full text-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            書き直す
          </Link>
        </div>
      </div>
    </main>
  );
}

function EntryDetail({
  entry,
}: {
  entry: NonNullable<Awaited<ReturnType<typeof getEntryByDate>>>;
}) {
  const bodyAnswer = entry.answers?.find((a) => a.question_position === 1);
  const textAnswer = entry.answers?.find((a) => a.question_position === 2);
  const closureAnswer = entry.answers?.find((a) => a.question_position === 3);

  const body = BODY_SENSATION_OPTIONS.find(
    (m) => m.value === bodyAnswer?.value_number,
  );

  // ADR-014: Q3 now stored in value_text; older v0 entries may have value_choice.
  const closureText = closureAnswer?.value_text ?? closureAnswer?.value_choice ?? null;

  return (
    <div className="space-y-4">
      <Section label="いまの体の感じ">
        {body ? (
          <div className="flex items-center gap-3">
            <MoonPhase phase={body.value} className="w-10 h-10" />
            <span className="text-base text-neutral-700">{body.label}</span>
          </div>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>

      <Section label="今日いちばん印象に残ったこと">
        {textAnswer?.value_text ? (
          <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {textAnswer.value_text}
          </p>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>

      <Section label="明日の自分にひとことだけ">
        {closureText ? (
          <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {closureText}
          </p>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>

      <p className="text-xs text-neutral-400 pt-2">
        記録日時:{" "}
        {entry.completed_at &&
          new Date(entry.completed_at).toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-5 space-y-2">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <div>{children}</div>
    </div>
  );
}
```

主な変更:
- `Props` に `searchParams: Promise<{ edit?: string }>` 追加
- import に `QuestionFlow`、`todayJST` 追加(`Edit2` icon は削除、未使用)
- 未来日チェック(`date > today`)で専用 message return
- `editing = edit === "1"` を判定、true なら QuestionFlow render(mode C)
- mode A(空欄)の button が `/today` link から `?edit=1` 内部遷移に変更
- mode B(detail)の最下部に「書き直す」link 追加
- `isToday` 変数を削除(今日も過去も同じ動線)
- `EntryDetail` / `Section` 関数は untouched

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: build で /calendar/[date] が ƒ(dynamic)として生成**

Run: `npm run build`
Expected: success、`/calendar/[date]` の行が表示される

- [ ] **Step 4: Commit**

```bash
git add app/calendar/[date]/page.tsx
git commit -m "feat: /calendar/[date] を 3 mode 化、過去日も書ける (issue #001)

mode A 空欄(過去/今日): 「この日のほしふみを書く」button → ?edit=1
mode B 既存 entry: 既存 detail + 「書き直す」button → ?edit=1
mode C 編集: 同 page 上で QuestionFlow render、initialEntry prefill
未来日: 「未来は書けません」message + 戻る link

入力 UI は既存 QuestionFlow を再利用、submit 後の redirect は
QuestionFlow 側が date で分岐済み(/today/done bloom or /calendar/[date] quiet)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 手動 smoke test

**Files:** なし(動作確認のみ)

- [ ] **Step 1: dev サーバー起動**

Run: `npm run dev`
Expected: `▲ Next.js 16.x ... Ready in 〜ms` 表示

- [ ] **Step 2: 既存 entry あり日(今日)の編集動線確認**

1. http://localhost:3000/calendar/[今日の日付] を開く
2. mode B: 既存 detail + 「書き直す」 button 表示確認
3. 「書き直す」tap → mode C(QuestionFlow)に遷移、prefill 確認
4. Q1/Q2/Q3 変更して submit → /today/done に着地、bloom 再生確認

- [ ] **Step 3: 空欄日(過去)の作成動線確認**

1. 例:http://localhost:3000/calendar/2026-05-10 を開く(空欄日)
2. mode A: 「この日の記録はありません」+ 「この日のほしふみを書く」button 確認
3. button tap → mode C 遷移、空 QuestionFlow 表示
4. Q1/Q2/Q3 入力 → submit → **/calendar/2026-05-10 に着地、mode B detail 表示、bloom 出ない** ことを確認
5. AppHeader streak chip / 月 grid の dot 反映確認(retroactive update が効いてる)

- [ ] **Step 4: 未来日の reject 確認**

1. http://localhost:3000/calendar/2027-01-01 を開く
2. 「未来は書けません」message + 戻る link 表示
3. http://localhost:3000/calendar/2027-01-01?edit=1 を直接叩く
4. 同じ「未来は書けません」message(server-side reject、QuestionFlow 出ない)

- [ ] **Step 5: retroactive callback 確認(任意、entry 数が境界の場合)**

現状の entries 数を確認(Supabase studio の table editor or remote dashboard で `entries` where user_id=自分 count)。
- 4本だったら → 過去日1つ書いて 5 に → 翌日 /today/done で Stage 1 callback 出る想定
- 既に 5本以上なら、シナリオを擬似的に再現するのは難しい(seed SQL での操作が必要)

scope: Phase 0 中に entries 数 = 4 で過去日埋めて 5 になった瞬間に観察、それまでは defer 可。

- [ ] **Step 6: dev サーバー停止**

`Ctrl+C` で dev サーバー終了

---

## Task 6: issue close + push + Vercel 再 deploy

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/issues/2026-05-18-past-date-journal-entry.md`(frontmatter)

- [ ] **Step 1: issue frontmatter を closed に更新**

`issues/2026-05-18-past-date-journal-entry.md` の frontmatter:

```yaml
---
id: 001
title: 過去日でジャーナル作成・編集
status: open
priority: medium
type: feature
opened: 2026-05-18
closed: null
related-spec: null
related-plan: null
related-commits: null
---
```

を以下に置換:

```yaml
---
id: 001
title: 過去日でジャーナル作成・編集
status: closed
priority: medium
type: feature
opened: 2026-05-18
closed: 2026-05-18
related-spec: docs/specs/2026-05-18-past-date-journal-entry-design.md
related-plan: docs/plans/2026-05-18-past-date-journal-entry.md
related-commits: null
---
```

(`related-commits` は最終 commit の SHA を後で追記、push 後でも OK)

- [ ] **Step 2: Commit**

```bash
git add issues/2026-05-18-past-date-journal-entry.md
git commit -m "chore(issues): close #001 過去日ジャーナル作成・編集

実装完了 (Task 1-4):
- selectCallbackEntry retroactive catch-up (>= 判定)
- submitEntry future date reject
- QuestionFlow redirect 分岐 (today→/today/done, past→/calendar/[date])
- /calendar/[date] 3 mode 化

spec: docs/specs/2026-05-18-past-date-journal-entry-design.md
plan: docs/plans/2026-05-18-past-date-journal-entry.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: main への push(user 認可要)**

```bash
git push origin main
```

main 直 push は autonomy mode classifier が block するので、user に明示認可を依頼してから実行。

- [ ] **Step 4: Vercel 本番 再 deploy(user 認可要)**

```bash
vercel --prod --yes
```

production の新 deploy URL を確認、`https://hoshifumi.vercel.app` で past date journal 動線が動くか実機確認(Task 5 を本番で再現)。
