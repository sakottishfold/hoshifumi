# テンプレートをユーザー設定にする Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テンプレートを「エントリごとに `/today` で inline 選択」から「ユーザー単位の設定。初回 onboarding で選び、設定画面で変更」に変える。

**Architecture:** `profiles.template_name`(nullable、NULL = onboarding 未完了)を新設。`/today` の server component が NULL を見て `/onboarding` へ誘導。onboarding と設定画面は共有の `TemplatePicker` + `setTemplate` server action でテンプレを更新。`/today` から inline switcher を撤去。`entries.template_name` は submit 時に `profiles.template_name` を焼き込む形で残す。

**Tech Stack:** Next.js 15 App Router / React 19 / TypeScript strict / Supabase / Tailwind v4

**設計根拠:** `docs/specs/2026-05-23-template-as-user-setting-design.md`

**検証方針:** 自動テストなし(CLAUDE.md)。各タスクの検証は `npm run typecheck`、UI を伴うタスクは `npm run build` も。動作確認は dev をスキップし Vercel 本番 deploy 後に手動 smoke。コミットは `main` 直(プロジェクトのワークフロー)。

---

## File Structure

| ファイル | 区分 | 責務 |
|---|---|---|
| `supabase/migrations/20260523010000_profile_template.sql` | 新規 | `profiles.template_name` 追加 + 既存 profile backfill |
| `lib/types.ts` | 変更 | `Profile.template_name` 追加 |
| `lib/constants/template.ts` | 変更 | basic の displayName / description 改名 |
| `lib/server-actions/profile.ts` | 新規 | `setTemplate` server action |
| `components/TemplatePicker.tsx` | 新規 | onboarding / 設定で共有する5択ピッカー |
| `app/onboarding/page.tsx` | 新規 | onboarding 画面(server component + 誘導ガード) |
| `app/onboarding/_components/OnboardingPicker.tsx` | 新規 | onboarding の client wrapper |
| `app/today/page.tsx` | 変更 | profiles.template_name を読む、NULL なら /onboarding へ |
| `app/today/_components/QuestionFlow.tsx` | 変更 | `TemplateSwitcher` と `templateName` state を撤去 |
| `app/today/_components/TemplateSwitcher.tsx` | 削除 | inline switcher 廃止 |
| `lib/server-actions/entries.ts` | 変更 | `getLastUsedTemplate()` 削除 |
| `app/settings/page.tsx` | 変更 | 「日記のテンプレート」カード追加 |
| `app/settings/_components/TemplateSetting.tsx` | 新規 | 設定画面のテンプレ変更 client wrapper |
| `docs/SPEC.md` | 変更 | テンプレ機能の記述を新モデルへ同期 |

---

## Task 1: DB マイグレーション(profiles.template_name)

**Files:**
- Create: `supabase/migrations/20260523010000_profile_template.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

`supabase/migrations/20260523010000_profile_template.sql`:

```sql
-- ADR-025: テンプレートをユーザー単位の設定にする。
-- profiles.template_name に「ユーザーが選んだ日記テンプレ」を持たせる。
-- NULL = onboarding 未完了(初回テンプレ選択前)。default は付けない
-- (「未完了」と「basic を選んだ」を区別するため)。
alter table profiles
  add column template_name text;

comment on column profiles.template_name is
  'ユーザーが選んだ日記テンプレ。NULL = onboarding 未完了(初回テンプレ選択前)。';

-- 既存 profile を backfill:直近エントリのテンプレ、無ければ basic。
-- これにより既存ユーザーは onboarding 画面を踏まずに済む。
update profiles p
set template_name = coalesce(
  (select e.template_name from entries e
   where e.user_id = p.id
   order by e.entry_date desc limit 1),
  'basic'
)
where p.template_name is null;
```

- [ ] **Step 2: コミット**

```bash
git add supabase/migrations/20260523010000_profile_template.sql
git commit -m "feat(db): profiles.template_name を追加(テンプレをユーザー設定に)"
```

> 適用は deploy 手順で Supabase に対し実行。typecheck / build は SQL に影響されない。

---

## Task 2: 型 + 定数 + setTemplate server action

**Files:**
- Modify: `lib/types.ts:72-83`(`Profile` interface)
- Modify: `lib/constants/template.ts:44-53`(basic テンプレ定義)
- Create: `lib/server-actions/profile.ts`

- [ ] **Step 1: `lib/types.ts` の `Profile` に `template_name` を追加**

`Profile` interface の `last_entry_at` の下に1行追加:

```typescript
export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  notification_time: string;
  notification_enabled: boolean;
  timezone: string;
  plan: "free" | "pro" | "premium";
  streak_days: number;
  longest_streak: number;
  last_entry_at: string | null;
  /** ADR-025: ユーザーが選んだ日記テンプレ。NULL = onboarding 未完了。 */
  template_name: string | null;
}
```

- [ ] **Step 2: `lib/constants/template.ts` の basic テンプレを改名**

`TEMPLATES` の `basic` 定義(現状 44-53 行)を次へ置換:

```typescript
  basic: {
    name: "basic",
    displayName: "きほん",
    emoji: "🌒",
    description: "ジャンルを決めずに、ふつうに置く",
    questions: buildQuestions(
      "今日いちばん印象に残ったこと",
      "ひとことでも、ふたことでも",
    ),
  },
```

- [ ] **Step 3: `lib/server-actions/profile.ts` を新規作成**

```typescript
"use server";

// ADR-025: ユーザープロファイルの更新 Server Action。
// 現状はテンプレ設定のみ。onboarding 画面と設定画面の両方から呼ばれる。

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_LIST } from "@/lib/constants/template";
import type { TemplateName } from "@/lib/types";

/**
 * 認証ユーザーの profiles.template_name を更新する。
 * 不明な template 名は拒否する。
 */
export async function setTemplate(templateName: string): Promise<void> {
  if (!TEMPLATE_LIST.includes(templateName as TemplateName)) {
    throw new Error(`Unknown template: ${templateName}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ template_name: templateName })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/today");
  revalidatePath("/settings");
}
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: エラーなし。`Profile.template_name` は additive、basic 改名は値変更のみ、`profile.ts` は新規ファイル。

- [ ] **Step 5: コミット**

```bash
git add lib/types.ts lib/constants/template.ts lib/server-actions/profile.ts
git commit -m "feat(template): Profile.template_name 型・setTemplate action・basic を「きほん」に改名"
```

---

## Task 3: TemplatePicker 共有コンポーネント

**Files:**
- Create: `components/TemplatePicker.tsx`

- [ ] **Step 1: `components/TemplatePicker.tsx` を新規作成**

```tsx
"use client";

// ADR-025: onboarding 画面と設定画面で共有するテンプレ5択ピッカー。
// 選択は親に onSelect で通知する(永続化は親が setTemplate action 経由で行う)。

import { TEMPLATES, TEMPLATE_LIST } from "@/lib/constants/template";
import type { TemplateName } from "@/lib/types";

interface Props {
  /** 現在選択中のテンプレ。onboarding では null(未選択)。 */
  current: string | null;
  onSelect: (name: TemplateName) => void;
  /** 選択処理中などに操作を止める。 */
  disabled?: boolean;
}

export function TemplatePicker({ current, onSelect, disabled }: Props) {
  return (
    <div className="space-y-2">
      {TEMPLATE_LIST.map((name) => {
        const t = TEMPLATES[name];
        const isCurrent = name === current;
        return (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(name)}
            className={
              isCurrent
                ? "w-full flex items-center gap-3 rounded-xl bg-primary-50 border border-primary-200 px-4 py-3 text-left disabled:opacity-50"
                : "w-full flex items-center gap-3 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-left hover:bg-neutral-100 disabled:opacity-50"
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

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: エラーなし(新規ファイル、まだ未使用だが有効)。

- [ ] **Step 3: コミット**

```bash
git add components/TemplatePicker.tsx
git commit -m "feat(template): 共有 TemplatePicker コンポーネントを追加"
```

---

## Task 4: Onboarding 画面

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/_components/OnboardingPicker.tsx`

- [ ] **Step 1: `app/onboarding/_components/OnboardingPicker.tsx` を新規作成**

```tsx
"use client";

// ADR-025: onboarding 画面の client wrapper。
// テンプレを1つ選ぶと setTemplate で永続化し /today へ遷移する。

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TemplatePicker } from "@/components/TemplatePicker";
import { setTemplate } from "@/lib/server-actions/profile";
import type { TemplateName } from "@/lib/types";

export function OnboardingPicker() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSelect(name: TemplateName) {
    startTransition(async () => {
      await setTemplate(name);
      router.push("/today");
    });
  }

  return (
    <TemplatePicker current={null} onSelect={handleSelect} disabled={pending} />
  );
}
```

- [ ] **Step 2: `app/onboarding/page.tsx` を新規作成**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingPicker } from "./_components/OnboardingPicker";

// ADR-025: 初回ログイン後のテンプレ選択画面。
// template_name 設定済み(onboarding 済み)なら /today へ弾く。
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("template_name")
    .eq("id", user.id)
    .single();

  if (profile?.template_name) {
    redirect("/today");
  }

  return (
    <main className="min-h-dvh flex flex-col">
      <div className="px-6 py-12 max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">
            どんな夜を綴る?
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            日記のテンプレートを選んでください。あとから設定で変えられます。
          </p>
        </div>
        <OnboardingPicker />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: いずれもエラーなし。`/onboarding` ルートが生成される。

- [ ] **Step 4: コミット**

```bash
git add app/onboarding/
git commit -m "feat(onboarding): 初回テンプレ選択画面を追加"
```

---

## Task 5: `/today` を profiles ベースに + switcher 撤去(原子的)

> `today/page.tsx` の `getLastUsedTemplate` 依存と `QuestionFlow` の `TemplateSwitcher` 依存が連結しているため、4ファイルを1コミットで原子的に変更する。コミットは全 step + typecheck/build green 後の1回。

**Files:**
- Modify: `app/today/page.tsx`(全面書き換え)
- Modify: `app/today/_components/QuestionFlow.tsx`(targeted edits)
- Delete: `app/today/_components/TemplateSwitcher.tsx`
- Modify: `lib/server-actions/entries.ts`(`getLastUsedTemplate` 削除)

- [ ] **Step 1: `app/today/page.tsx` を全面書き換え**

ファイル全体を次へ置換:

```tsx
import { redirect } from "next/navigation";
import { todayJST, formatDisplay } from "@/lib/utils/date";
import { getEntryByDate } from "@/lib/server-actions/entries";
import { createClient } from "@/lib/supabase/server";
import { QuestionFlow } from "./_components/QuestionFlow";
import { AppHeader } from "@/components/AppHeader";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ADR-025: テンプレ未選択(onboarding 未完了)なら onboarding へ誘導
  const { data: profile } = await supabase
    .from("profiles")
    .select("template_name")
    .eq("id", user.id)
    .single();
  if (!profile?.template_name) {
    redirect("/onboarding");
  }

  const today = todayJST();
  const entry = await getEntryByDate(today);
  const isCompleted = !!entry?.completed_at;

  // 編集なら entry 自身の template、新規ならユーザー設定の template
  const templateName = entry
    ? (entry.template_name ?? "basic")
    : profile.template_name;

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-8 max-w-md mx-auto">
        <div className="mb-8 text-center">
          <p className="text-xs text-neutral-500">
            {formatDisplay(today)}
          </p>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1">
            {isCompleted ? "今日のほしふみ" : "今日のほしふみ、はじめよう"}
          </h1>
        </div>
        <QuestionFlow
          initialEntry={entry}
          date={today}
          displayDate={formatDisplay(today)}
          initialTemplateName={templateName}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: `QuestionFlow.tsx` から `TemplateSwitcher` と `templateName` state を撤去**

(a) import 行(現状 7 行目)`import { TemplateSwitcher } from "./TemplateSwitcher";` を**削除**。

(b) type import 行(現状 16 行目)を次へ置換(`TemplateName` を除去):

```typescript
import type { MoodOption, EntryWithAnswers, FollowUpTurn } from "@/lib/types";
```

(c) `templateName` の `useState`(現状 34-36 行)を**削除**。削除対象はこの3行のみ:

```typescript
  const [templateName, setTemplateName] = useState<TemplateName>(
    (initialTemplateName as TemplateName) ?? "basic",
  );
```

(d) `questions` の定義(現状 73 行)を次へ置換:

```typescript
  const questions = getTemplate(initialTemplateName).questions;
```

(e) `submitEntry` 呼び出しの `templateName,`(現状 112 行)を次へ置換:

```typescript
        templateName: initialTemplateName,
```

(f) step 0 の `TemplateSwitcher` render ブロック(現状 254-261 行)を**削除**。削除対象:

```tsx
        {step === 0 && initialEntry === null && (
          <div>
            <TemplateSwitcher
              current={templateName}
              onSelect={setTemplateName}
            />
          </div>
        )}
```

(`Props` の `initialTemplateName: string` はそのまま残す ── 過去日編集で `app/calendar/[date]` がこの prop を使うため。)

- [ ] **Step 3: `TemplateSwitcher.tsx` を削除**

```bash
git rm app/today/_components/TemplateSwitcher.tsx
```

- [ ] **Step 4: `lib/server-actions/entries.ts` から `getLastUsedTemplate` を削除**

`getLastUsedTemplate` 関数とその doc コメント(現状 127-145 行 ── `/** 直近の完了 entry の template_name を返す。... */` から関数の閉じ `}` まで)を**削除**。`submitEntry` / `getEntryByDate` / `getEntriesForMonth` は残す。

- [ ] **Step 5: 他に `getLastUsedTemplate` / `TemplateSwitcher` の参照が無いか確認**

Run: `grep -rn "getLastUsedTemplate\|TemplateSwitcher" app lib`
Expected: 出力なし(Step 1-4 で全て除去済み)。出力があれば該当箇所を確認し除去する。

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: いずれもエラーなし。`TemplateName` 未使用エラーが出たら QuestionFlow の import 行に除去漏れ。

- [ ] **Step 7: コミット**

```bash
git add app/today/page.tsx app/today/_components/QuestionFlow.tsx \
  app/today/_components/TemplateSwitcher.tsx lib/server-actions/entries.ts
git commit -m "feat(today): inline switcher 撤去、テンプレを profiles から取得"
```

---

## Task 6: 設定画面に「日記のテンプレート」カード

**Files:**
- Create: `app/settings/_components/TemplateSetting.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: `app/settings/_components/TemplateSetting.tsx` を新規作成**

```tsx
"use client";

// ADR-025: 設定画面のテンプレ変更 UI。閉じた状態は現在テンプレを表示、
// タップで TemplatePicker を inline 展開。選択で setTemplate → 画面更新。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/constants/template";
import { TemplatePicker } from "@/components/TemplatePicker";
import { setTemplate } from "@/lib/server-actions/profile";
import type { TemplateName } from "@/lib/types";

interface Props {
  current: string;
}

export function TemplateSetting({ current }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = TEMPLATES[current as TemplateName] ?? TEMPLATES.basic;

  function handleSelect(name: TemplateName) {
    startTransition(async () => {
      await setTemplate(name);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-neutral-50 px-4 py-3 flex items-center justify-between text-sm hover:bg-neutral-100"
      >
        <span className="text-neutral-600">いまのテンプレート</span>
        <span className="text-neutral-900 font-medium">{t.displayName}</span>
      </button>
    );
  }

  return (
    <div className="bg-neutral-50 px-4 py-3 space-y-2">
      <TemplatePicker
        current={current}
        onSelect={handleSelect}
        disabled={pending}
      />
    </div>
  );
}
```

- [ ] **Step 2: `app/settings/page.tsx` に「日記のテンプレート」カードを追加**

import に1行追加(現状の import 群の末尾):

```typescript
import { TemplateSetting } from "./_components/TemplateSetting";
```

「アカウント」`SettingsCard` の閉じ `</SettingsCard>` の直後、「灯した夜」`SettingsCard` の前に、次のブロックを挿入:

```tsx
          <SettingsCard title="日記のテンプレート">
            <TemplateSetting current={profile?.template_name ?? "basic"} />
          </SettingsCard>
```

(`profile` は `.select("*")` で取得済みなので、migration 後は `profile.template_name` が読める。)

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: いずれもエラーなし。

- [ ] **Step 4: コミット**

```bash
git add app/settings/page.tsx app/settings/_components/TemplateSetting.tsx
git commit -m "feat(settings): 日記のテンプレート変更カードを追加"
```

---

## Task 7: ドキュメント同期

**Files:**
- Modify: `docs/SPEC.md`(テンプレ機能の記述)
- Modify: `docs/specs/2026-05-23-template-as-user-setting-design.md`(Status 行)

- [ ] **Step 1: `docs/SPEC.md` をテンプレ新モデルへ同期**

`docs/SPEC.md` のテンプレ機能の記述を実装に合わせて更新する。`grep -n "テンプレ\|template" docs/SPEC.md` で該当箇所を洗い出し、最低限:
- テンプレは「`/today` step 0 の inline switcher で選ぶ」→「`profiles.template_name` のユーザー設定。初回 onboarding で選択、設定画面で変更」へ。
- `getLastUsedTemplate` / sticky last-used の記述があれば削除。
- `profiles` テーブルに `template_name` 列が増えた旨。`/onboarding` ルートが増えた旨。

既存のプロース体裁・日本語を保つ。実装挙動を超える詳細は足さない。

- [ ] **Step 2: 設計ドキュメントの Status を更新**

`docs/specs/2026-05-23-template-as-user-setting-design.md` の 3 行目を:

```
> Status: **実装完了**(2026-05-23)
```

- [ ] **Step 3: コミット**

```bash
git add docs/SPEC.md docs/specs/2026-05-23-template-as-user-setting-design.md
git commit -m "docs(spec): テンプレのユーザー設定化を SPEC に反映"
```

- [ ] **Step 4: ADR-025 の diff をオーナーに提案(コミットしない)**

`docs/DECISIONS.md` はオーナー管理・直接編集禁止(CLAUDE.md)。ADR-025「テンプレートをユーザー単位の設定にする(onboarding 選択 + 設定変更、inline switcher 廃止)」の本文 diff をチャットで提案する。`docs/DECISIONS.md` の ADR-024 の house format に揃え、spec `2026-05-21-additional-templates-design.md` §7.1 の inline switcher モデルを覆す旨を明記。追加テンプレート機能(5テンプレ体制)自体は廃止しないことも明記。

---

## Self-Review(プラン作成者によるチェック ─ 完了済み)

**Spec coverage:**
- 設計 #1 `profiles.template_name` → Task 1 + Task 2 Step 1 ✓
- 設計 #2 onboarding → Task 4 + Task 5 Step 1(/today ガード)✓
- 設計 #3 設定画面で変更 → Task 6 ✓
- 設計 #4 inline switcher 撤去 → Task 5 ✓
- 設計 #5 basic 改名 → Task 2 Step 2 ✓
- 設計 §8 TemplatePicker / setTemplate → Task 3 / Task 2 Step 3 ✓
- 設計 §11 ADR-025 → Task 7 Step 4 ✓
- SPEC.md 同期 → Task 7 ✓

**Placeholder scan:** TBD / TODO なし。全 step に実コードまたは具体コマンドあり。

**Type consistency:** `setTemplate(templateName: string)`(Task 2)を OnboardingPicker / TemplateSetting が一貫呼び出し。`TemplatePicker` の Props(`current: string | null` / `onSelect: (name: TemplateName) => void` / `disabled?`)を Task 3 で定義、Task 4・6 が同じ shape で使用。`Profile.template_name: string | null`(Task 2)を today/page・settings・onboarding が参照。`QuestionFlow` の `initialTemplateName: string` prop は維持され `app/calendar/[date]` から不変。

---

## 本番デプロイ後の手動 smoke チェックリスト(設計 §14)

- [ ] 新規ユーザー(`template_name` NULL)→ `/today` → `/onboarding` に誘導される
- [ ] onboarding でジャンルをタップ → `/today` に遷移、選んだテンプレの Q2 が出る
- [ ] onboarding 済みユーザーが `/onboarding` を直打ち → `/today` に弾かれる
- [ ] `/today` に inline ピルが出ない
- [ ] 設定画面に「日記のテンプレート」カードがあり現在のテンプレが表示される
- [ ] 設定でテンプレ変更 → 次に `/today` で書くと新テンプレの Q2 が出る
- [ ] 設定変更後も過去エントリの Q2 ラベルは当時のテンプレのまま(`/calendar/[date]`)
- [ ] basic テンプレが「きほん」と表示される
- [ ] 既存 profile(オーナー)が backfill 済みで onboarding を踏まない
