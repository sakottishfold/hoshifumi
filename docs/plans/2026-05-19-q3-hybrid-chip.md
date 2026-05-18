# Q3 hybrid chip + text escape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Q3「明日の自分にひとこと」を free text から hybrid chip(4 個)+ 「自由に書く」escape へ変更、ADR-014 を partial supersede(ADR-023)。

**Architecture:** 新 input_type `chip_with_text`、template Q3 改修、新規 `ChipWithTextEscape.tsx` component、QuestionFlow に Q3 step 分岐、submitEntry が chip / text を value_choice / value_text 排他保存、EntryDetail で display 分岐。DB schema 変更なし。

**Tech Stack:** Next.js 16 App Router / React 19 / TypeScript strict / Tailwind v4 / Supabase Server Actions(既存)

**Spec reference:** `docs/specs/2026-05-19-q3-hybrid-chip-design.md` / ADR-023(`docs/DECISIONS.md` 末尾)

---

## File Structure

```
修正:
  lib/types.ts                                # InputType union に "chip_with_text" 追加
  lib/constants/template.ts                   # BASIC_TEMPLATE Q3 を chip_with_text + options 4 個
  app/today/_components/QuestionFlow.tsx      # Q3 state 拡張 + ChipWithTextEscape render 分岐
  lib/server-actions/entries.ts               # SubmitEntryInput + answers insert 分岐
  app/calendar/[date]/page.tsx                # EntryDetail Q3 display 分岐(chip / text)

新規:
  app/today/_components/ChipWithTextEscape.tsx  # hybrid input component

ドキュメント:
  docs/NEXT-ACTIONS.md                        # 完了マーク追記
```

各ファイル単一責任:
- `types.ts`:type 定義
- `template.ts`:template content data
- `ChipWithTextEscape.tsx`:presentation only、state は親で管理
- `QuestionFlow.tsx`:flow state machine + render dispatch
- `entries.ts`:data layer、chip / text を排他保存
- `EntryDetail` in `page.tsx`:display 分岐

---

## Task 1: types.ts + template.ts(data foundation)

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/types.ts:1-6`
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/constants/template.ts`(BASIC_TEMPLATE Q3 部)

### Step 1: lib/types.ts の InputType に "chip_with_text" を追加

`lib/types.ts` 先頭の以下の type 定義:

```typescript
export type InputType =
  | "mood_5"
  | "scale_5"
  | "rating_4"
  | "short_choice"
  | "free_text";
```

を以下に置換(末尾に新 union member 追加):

```typescript
export type InputType =
  | "mood_5"
  | "scale_5"
  | "rating_4"
  | "short_choice"
  | "free_text"
  | "chip_with_text"; // ADR-023: Q3 hybrid chip + text escape
```

### Step 2: lib/constants/template.ts の BASIC_TEMPLATE Q3 を改修

`lib/constants/template.ts` を読み、`BASIC_TEMPLATE.questions` 配列の **3 番目要素(position: 3、Q3)** を特定。現在 `input_type: "free_text"` のはず。

その Q3 question オブジェクトを以下のように置換(ADR-014 のコメントは履歴として更新):

```typescript
{
  position: 3,
  text: "明日の自分にひとことだけ",
  // ADR-023: input_type を free_text から chip_with_text に再変更。
  // ADR-014 が free_text にした(短文 chip → 自由記述 closure)が、
  // Phase 0 Day 2 owner 観察で「明日もがんばろう」化が判明、軽い ritual closure として
  // chip default + 自由記述 escape の hybrid に。
  input_type: "chip_with_text",
  placeholder: "思ったままに",
  options: [
    "明日もがんばる",
    "ゆっくり眠る",
    "今日はここまで",
    "そのままで",
  ],
}
```

(`options` field は既存 Question type が `MoodOption[] | string[]` を受けるので、`string[]` で OK)

### Step 3: typecheck

Run: `pnpm typecheck`
Expected: エラーなし

(現状 QuestionFlow が `q.input_type === "free_text" && step === 2` で Q3 を render しているので、上記置換後は Q3 step で何も render されなくなる ─ Task 3 で QuestionFlow を更新するまでは UI 上 Q3 が空になる、間 commit でも build は通る)

### Step 4: build

Run: `pnpm build`
Expected: success(Q3 が空 render になるが route 自体は生成される)

### Step 5: Commit

```bash
git add lib/types.ts lib/constants/template.ts
git commit -m "feat(template): Q3 を chip_with_text + 4 chip + escape options に (ADR-023)

InputType union に chip_with_text 追加、BASIC_TEMPLATE Q3 改修
(明日もがんばる / ゆっくり眠る / 今日はここまで / そのままで)。
本 commit 単体では QuestionFlow が free_text branch しか持たないため
Q3 が空 render になる、Task 3 で render 分岐を追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ChipWithTextEscape.tsx 新規 component

**Files:**
- Create: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/ChipWithTextEscape.tsx`

### Step 1: ChipWithTextEscape component を作成

```typescript
"use client";

// ADR-023 Q3 hybrid chip + text escape UI。
// default = chip grid + 「自由に書く」link、escape mode = textarea + 「← chip に戻る」link。
// state は親(QuestionFlow)で集約、本 component は presentation + event 通知のみ。

interface Props {
  chips: string[];
  /** chip 選択時の current value、未選択は null */
  selectedChip: string | null;
  /** text escape mode の current value */
  textValue: string;
  /** "chip" | "text" のどちらが active か */
  mode: "chip" | "text";
  onChipSelect: (chip: string) => void;
  onTextChange: (text: string) => void;
  onModeToggle: (mode: "chip" | "text") => void;
}

export function ChipWithTextEscape({
  chips,
  selectedChip,
  textValue,
  mode,
  onChipSelect,
  onTextChange,
  onModeToggle,
}: Props) {
  if (mode === "text") {
    return (
      <div className="space-y-4">
        <textarea
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          rows={3}
          placeholder="思ったままに"
          className="w-full rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-base leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
        />
        <button
          type="button"
          onClick={() => onModeToggle("chip")}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← chip に戻る
        </button>
      </div>
    );
  }

  // mode === "chip"
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {chips.map((chip) => {
          const isSelected = selectedChip === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onChipSelect(chip)}
              className={
                isSelected
                  ? "rounded-xl bg-primary-500 px-4 py-3 text-base font-medium text-neutral-50 shadow-sm transition active:scale-[0.99]"
                  : "rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-100 transition active:scale-[0.99]"
              }
            >
              {chip}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onModeToggle("text")}
        className="text-sm text-neutral-500 hover:text-neutral-700"
      >
        自由に書く
      </button>
    </div>
  );
}
```

### Step 2: typecheck

Run: `pnpm typecheck`
Expected: エラーなし

### Step 3: build

Run: `pnpm build`
Expected: success(component は単体では import されない、Task 3 で QuestionFlow から使われる)

### Step 4: Commit

```bash
git add app/today/_components/ChipWithTextEscape.tsx
git commit -m "feat: ChipWithTextEscape component (ADR-023)

chip mode = grid + 自由に書く link、text mode = textarea + chip 戻る link。
state は親(QuestionFlow)集約、本 component は presentation 専。
chip 選択は bg-primary-500 highlight、非選択は border-neutral-200。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: QuestionFlow.tsx に Q3 state + render 分岐統合

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/today/_components/QuestionFlow.tsx`

### Step 1: import + state 追加

`app/today/_components/QuestionFlow.tsx` の import 群、`AIQuestionStep` import の下に追加:

```typescript
import { ChipWithTextEscape } from "./ChipWithTextEscape";
```

`QuestionFlow` 関数内、既存 `tomorrowMessage` state の **直下** に以下を追加:

```typescript
  // ADR-023 Q3 hybrid: chip 選択 と text escape の state、排他管理
  const initialQ3Chip = initialEntry?.answers?.find((a) => a.question_position === 3)
    ?.value_choice ?? null;
  const initialQ3Text = initialEntry?.answers?.find((a) => a.question_position === 3)
    ?.value_text ?? "";
  const [tomorrowChip, setTomorrowChip] = useState<string | null>(initialQ3Chip);
  const [q3Mode, setQ3Mode] = useState<"chip" | "text">(
    // 既存 entry が text only(ADR-014 期 free text)なら text mode で開く
    initialQ3Chip ? "chip" : initialQ3Text ? "text" : "chip",
  );
```

(既存 `const initialQ3 = initialEntry?.answers?.find((a) => a.question_position === 3);` の行は残し、`tomorrowMessage` の initial 値の参照に使う ─ touch しない)

### Step 2: canAdvance を Q3 で chip / text どちらか OK に変更

既存 `canAdvance` 算出(step 2 branch):

```typescript
    if (step === 2) return tomorrowMessage.trim().length > 0;
```

を以下に置換(chip 選択 OR text 入力で advance 可):

```typescript
    if (step === 2) {
      return q3Mode === "chip"
        ? tomorrowChip !== null
        : tomorrowMessage.trim().length > 0;
    }
```

### Step 3: handleSubmit が chip / text を排他で submitEntry に渡す

既存 `handleSubmit` の `submitEntry({...})` 呼び出し:

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

を以下に置換(Q3 を chip / text 排他で渡す):

```typescript
      const result = await submitEntry({
        date,
        bodySensation,
        freeText: freeText.trim(),
        // ADR-023: Q3 は chip(value_choice 行き) or text(value_text 行き)排他
        tomorrowChip: q3Mode === "chip" ? (tomorrowChip ?? undefined) : undefined,
        tomorrowMessage:
          q3Mode === "text" && tomorrowMessage.trim()
            ? tomorrowMessage.trim()
            : undefined,
        aiQuestion: aiQuestion ?? undefined,
        aiAnswer: aiAnswer.trim() ? aiAnswer.trim() : undefined,
      });
```

### Step 4: render に Q3 chip_with_text 分岐を追加

既存の input_type 分岐ブロック内、`{q.input_type === "free_text" && step === 2 && ...}` の **直後** に以下を追加(free_text branch は dead code 化、後で削除可だが本 task では touch しない):

```jsx
          {q.input_type === "chip_with_text" && step === 2 && (
            <ChipWithTextEscape
              chips={(q.options as string[]) ?? []}
              selectedChip={tomorrowChip}
              textValue={tomorrowMessage}
              mode={q3Mode}
              onChipSelect={(chip) => {
                setTomorrowChip(chip);
                setTomorrowMessage(""); // chip 選んだら text reset、排他維持
              }}
              onTextChange={setTomorrowMessage}
              onModeToggle={(newMode) => {
                setQ3Mode(newMode);
                if (newMode === "chip") {
                  setTomorrowMessage(""); // chip 戻る時 text reset
                } else {
                  setTomorrowChip(null); // text 行く時 chip reset
                }
              }}
            />
          )}
```

### Step 5: 確認画面(isComplete block)の Q3 表示を chip / text 分岐

既存の isComplete render block 内、「明日へ」行の表示:

```jsx
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 w-16">明日へ</span>
              <span className="text-neutral-800">{tomorrowMessage}</span>
            </div>
```

を以下に置換:

```jsx
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 w-16">明日へ</span>
              <span className="text-neutral-800">
                {q3Mode === "chip" ? (tomorrowChip ?? "") : tomorrowMessage}
              </span>
            </div>
```

### Step 6: typecheck

Run: `pnpm typecheck`
Expected: 一旦エラー出る(`submitEntry` の `tomorrowMessage` が optional になってない、Task 4 で entries.ts を更新するまで)。**ただし type error を看過しないため、Task 4 と一緒に commit する判断もアリ**。

**判断:本 task では typecheck pass を待たず commit せず、Task 4 と statement 統合し Task 4 末尾で typecheck + commit する。**

→ Step 7 / 8 / 9 は Task 4 に統合(後述 Task 4 の commit 内に QuestionFlow 変更も含める)。

(あるいは順序を Task 3 → Task 4 に sequential 実行する前提で、Task 4 完了後に Task 3 + 4 の両 file を 1 commit にまとめる ─ subagent flow ではこちらが綺麗)

**recommended approach**: Task 4 を先に実行 → Task 3 を実行 → 両方 staged 後にまとめて 1 commit(後述 Task 4 内に詳述)。

---

## Task 4: submitEntry を Q3 chip / text 受け取りに拡張(Task 3 と同 commit)

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/lib/server-actions/entries.ts`

### Step 1: SubmitEntryInput interface を更新

`lib/server-actions/entries.ts` の interface 定義(現状):

```typescript
interface SubmitEntryInput {
  date?: string;
  bodySensation: number;
  freeText: string;
  tomorrowMessage: string;
  aiQuestion?: string;
  aiAnswer?: string;
}
```

を以下に置換(`tomorrowMessage` を optional 化 + `tomorrowChip` 追加):

```typescript
interface SubmitEntryInput {
  date?: string;
  bodySensation: number;
  freeText: string;
  /** ADR-023: Q3 は chip(value_choice 行き) or text(value_text 行き)排他。両方 undefined なら Q3 行 insert なし(将来防御)*/
  tomorrowChip?: string;
  tomorrowMessage?: string;
  aiQuestion?: string;
  aiAnswer?: string;
}
```

### Step 2: answers 配列の Q3 行を chip / text 分岐に変更

既存の answers 配列定義(Task 7 で explicit type 化済み):

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
```

を以下に置換(answers 配列の type に `value_choice` 追加 + Q3 行を排他構築):

```typescript
  const answers: Array<{
    entry_id: string;
    question_position: number;
    value_number?: number;
    value_text?: string;
    value_choice?: string;
    question_text?: string;
  }> = [
    { entry_id: entry.id, question_position: 1, value_number: input.bodySensation },
    { entry_id: entry.id, question_position: 2, value_text: input.freeText },
  ];

  // ADR-023: Q3 は chip(value_choice)or text(value_text)排他。
  // chip 優先(両方渡された場合 chip 採用、防御)、両方 undefined なら Q3 行を insert しない。
  if (input.tomorrowChip) {
    answers.push({
      entry_id: entry.id,
      question_position: 3,
      value_choice: input.tomorrowChip,
    });
  } else if (input.tomorrowMessage) {
    answers.push({
      entry_id: entry.id,
      question_position: 3,
      value_text: input.tomorrowMessage,
    });
  }
```

(既存 ADR-014 comment は意味が変わったので削除 ─ ADR-023 の comment に置き換わる)

### Step 3: typecheck

Run: `pnpm typecheck`
Expected: Task 3 の QuestionFlow 変更とこの Task 4 の entries.ts 変更で type 整合。エラーなし。

(もし Task 3 を先に commit し Task 4 を後に commit する場合、Task 3 commit 時点で type error。**Task 3 と Task 4 を同じ commit にする推奨**)

### Step 4: build

Run: `pnpm build`
Expected: success

### Step 5: Task 3 + Task 4 を同 commit でまとめる

```bash
git add lib/server-actions/entries.ts app/today/_components/QuestionFlow.tsx
git commit -m "feat: Q3 chip / text 排他 submit + QuestionFlow 統合 (ADR-023)

QuestionFlow: ChipWithTextEscape render 分岐、chip / text mode state、
canAdvance + handleSubmit + 確認画面の表示を chip / text 排他で。
submitEntry: tomorrowChip optional 追加、value_choice / value_text 排他保存
(chip 優先、両方なしなら Q3 行 insert しない)。

DB schema 変更なし、ADR-014 期 entries(value_text のみ)互換。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: EntryDetail で Q3 display 分岐

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/app/calendar/[date]/page.tsx`(EntryDetail 内 Q3 Section)

### Step 1: Q3 Section を chip / text 分岐に変更

`app/calendar/[date]/page.tsx` の `EntryDetail` 関数内、Q3 表示の Section(現状):

```typescript
      <Section label="明日の自分にひとことだけ">
        {closureText ? (
          <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {closureText}
          </p>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>
```

の **直前** にある `const closureText` の算出:

```typescript
  // ADR-014: Q3 now stored in value_text; older v0 entries may have value_choice.
  const closureText = closureAnswer?.value_text ?? closureAnswer?.value_choice ?? null;
```

を以下に置換(chip / text を別変数に分離):

```typescript
  // ADR-023: Q3 は chip(value_choice) or text(value_text) 排他。
  // ADR-014 期 entries は value_text のみ、v0 期は value_choice、それぞれ自然に分岐。
  const q3Chip = closureAnswer?.value_choice ?? null;
  const q3Text = closureAnswer?.value_text ?? null;
```

そして Q3 Section の body を以下に置換:

```typescript
      <Section label="明日の自分にひとことだけ">
        {q3Chip ? (
          <span className="inline-block rounded-full bg-primary-50 border border-primary-100 px-3 py-1 text-sm text-primary-700">
            {q3Chip}
          </span>
        ) : q3Text ? (
          <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap">
            {q3Text}
          </p>
        ) : (
          <p className="text-neutral-400">記録なし</p>
        )}
      </Section>
```

### Step 2: typecheck

Run: `pnpm typecheck`
Expected: エラーなし

### Step 3: build

Run: `pnpm build`
Expected: success(`/calendar/[date]` route 維持)

### Step 4: Commit

```bash
git add app/calendar/[date]/page.tsx
git commit -m "feat: EntryDetail Q3 display を chip / text 分岐 (ADR-023)

chip 選択 entry → rounded-full chip-like 表示(bg-primary-50 + primary-700)、
text 入力 entry → 既存 whitespace-pre-wrap 表示、両方 null → 記録なし。
ADR-014 期 free text entries(value_text のみ)は text path で自然 handle。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 手動 smoke test(dev サーバー)

**Files:** なし(動作確認のみ)

### Step 1: dev サーバー起動

Run: `pnpm dev`
Expected: `Ready in 〜ms` 表示

### Step 2: 新規 entry の chip submit path

1. /today を開く(or PWA から)
2. Q1 体感タップ
3. Q2 自由記述 → つぎへ
4. AI step → 回答 → つぎへ
5. **Q3 step で 4 chip + 「自由に書く」link 表示確認**
6. chip 1 つ tap → highlighted、「つぎへ」活性化
7. 別 chip tap → 選択切替
8. 「つぎへ」 → 確認画面 → 「明日へ」行に選択した chip 表示
9. 「保存する」 → /today/done(bloom)
10. /calendar/[今日] で確認 → Q3 Section に **rounded-full chip 表示**

### Step 3: 新規 entry の text escape path

1. /today で新規 submit(or 編集モード)
2. Q3 step で「自由に書く」link tap
3. **textarea + 「← chip に戻る」link 表示確認**
4. text 入力 → 「つぎへ」活性化
5. 「← chip に戻る」tap → chips 復帰、入力中 text は reset
6. もう一度「自由に書く」 → text 入力 → 「つぎへ」 → 確認画面 → 「明日へ」行に text 表示
7. 保存 → /calendar/[今日] で **whitespace-pre-wrap text 表示**

### Step 4: 既存 entries(ADR-014 期 free text)の互換

1. /calendar/[既存 entry の date] を開く
2. Q3 Section に **whitespace-pre-wrap text 表示**(既存挙動維持)
3. 「書き直す」 tap → Q3 step に到達
4. `q3Mode === "text"` で開く(initial 値判定で text only → text mode)、textarea に既存 text prefill
5. 「← chip に戻る」 → chips、新規に chip 選択可

### Step 5: edge case smoke

- Q3 で chip 選択 → 「自由に書く」 → text 入力 → 「← chip に戻る」 → chip 選択 ─ 各 state 反映確認
- Q3 何も選ばず確認画面に行く → 「つぎへ」disabled で進めない
- 「修正する」で確認画面から戻る → Q3 step の state 維持(chip 選択 / text 入力どちらも復元)

### Step 6: dev サーバー停止

`Ctrl+C` で停止

---

## Task 7: NEXT-ACTIONS マーク + push + Vercel deploy

**Files:**
- Modify: `/Users/masayafukazawa/workspace/me/hoshifumi/docs/NEXT-ACTIONS.md`

### Step 1: NEXT-ACTIONS に「Q3 hybrid chip 実装完了」を追記

`docs/NEXT-ACTIONS.md` の 🌓 v1.0 コア機能セクションに、AI follow-up の完了マークの **下** に以下を追加:

```markdown
- [x] ~~**Q3 hybrid chip + text escape 実装**~~ **2026-05-19 完了** ─ Phase 0 Day 2 owner 観察(「明日もがんばろう」化)で ADR-014 を partial supersede。default 4 chip(明日もがんばる / ゆっくり眠る / 今日はここまで / そのままで)+「自由に書く」escape。spec: `docs/specs/2026-05-19-q3-hybrid-chip-design.md`、plan: `docs/plans/2026-05-19-q3-hybrid-chip.md`、ADR: ADR-023
```

### Step 2: Commit

```bash
git add docs/NEXT-ACTIONS.md
git commit -m "docs: mark Q3 hybrid chip 実装完了 in NEXT-ACTIONS

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

新 deploy URL を確認、`https://hoshifumi.vercel.app/today` で Q3 hybrid が動くか実機確認(Task 6 を本番で再現)。
