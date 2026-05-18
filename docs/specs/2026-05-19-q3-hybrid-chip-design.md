# Q3 hybrid chip + text escape ─ Design

> Status: **承認待ち**(オーナーレビュー後 writing-plans へ)
> 日付: 2026-05-19
> 関連 ADR: ADR-014(本 spec が partial supersede)/ ADR-023(本 spec を成立させる新 ADR、parallel 起草)/ ADR-008(streak 罰しない)/ ADR-019(worldview)
> ブレスト履歴: 本セッション 2026-05-19、Phase 0 Day 2 の owner 自己観察起点

---

## 1. Overview

Q3「明日の自分にひとこと」を free text(ADR-014)から **hybrid chip + text escape** に変更:default は 4 chip から 1 tap で選択、特別な日は「自由に書く」link で textarea に展開。AI follow-up(ADR-012)で深い探索が済んだ後の Q3 を「軽い ritual closure」に再定義。

Phase 0 Day 2 の owner 観察:**free text Q3 が「明日もがんばろう」化** = ADR-014 が hope した「深い closure」になっておらず実質 chip と同じ役割に collapse。free text の柔軟性は逃がしつつ chip の軽快さを default にする hybrid 設計。

---

## 2. Context と決定の経緯

### ADR-014 の前提と実行後の乖離

- **ADR-014(2026-05-14)**:Q3 を v0 短文 chip(「がんばれ / ゆっくりしよう / 今日はOK / 昨日のままで / なにか変えたい」)から free text に変更。理由は「ユーザー自身の言葉のほうが活きる」+「AI 深掘りの後にチップに戻ると jarring」
- **2026-05-18 AI follow-up 実装**:ADR-012 通り Q2 と Q3 の間に AI 質問 step 挿入
- **2026-05-19 owner 観察**:Phase 0 Day 2 で「Q3 が『明日もがんばろう』化、free text の深さを使ってない」と自己観察
- ADR-014 の「jarring 予測」と「深い closure」hope の両方が実行後 user 行動と乖離

### 新仮説

- AI step が「深い探索」を担っている時点で、Q3 は「軽い ritual closure」で十分(役割分担明確化)
- 「明日もがんばろう」level の closure を free text input で要求すると、cognitive load(「何を書こう」)が closure 軽快さに逆らう
- **chip の軽快さ + 特別な日への text escape** = ADR-014 が捨てた「user 言葉の柔軟性」を部分継承しつつ、ADR-014 が達成しなかった「軽快な closure」を成立させる

### 決定

| 決定点 | 採用 | 理由 |
|---|---|---|
| Q3 input type | **hybrid chip + text escape** | chip default、「自由に書く」link で textarea expand |
| chip 個数 | **4** | 3 だと足りない、5 だと迷う、4 が bite-size |
| chip text | 明日もがんばる / ゆっくり眠る / 今日はここまで / そのままで | owner default 含む、WORLDVIEW YES list 整合 |
| escape 復帰 | あり | 「← chip に戻る」link、誤展開からの回復 |
| storage | value_choice = chip / value_text = escape text、排他 | DB 既存 schema 維持、追加 column 不要 |
| 既存 entries 互換 | value_text のみで残る、display で自然に handle | migration 不要 |

---

## 3. User Experience

### 3.1 default state(chip 選択)

```
[ProgressDots 3/3]
3つめ
明日の自分にひとことだけ

┌────────────┐ ┌────────────┐
│ 明日もがんばる │ │ ゆっくり眠る │
└────────────┘ └────────────┘
┌────────────┐ ┌────────────┐
│ 今日はここまで │ │ そのままで  │
└────────────┘ └────────────┘

       自由に書く ←

[「つぎへ」(disabled until chip 選択)]
```

chip tap:
- 選択 chip が highlighted(`bg-primary-500` + `text-neutral-50`)、他は default(`bg-neutral-50 border-neutral-200`)
- 「つぎへ」 button 活性化
- 他 chip tap で選択切替可

「自由に書く」link tap:
- chips fade-out + 退場、textarea fade-in
- 「← chip に戻る」link で復帰可

### 3.2 text escape mode

```
[ProgressDots 3/3]
3つめ
明日の自分にひとことだけ

[Textarea(rows=3、Q2 と同じ style)]

← chip に戻る

[「つぎへ」(disabled until 文字入力)]
```

「← chip に戻る」tap:
- textarea fade-out、chips fade-in
- text 入力中だった場合、内容は local state に保持(復帰したら復元、ただし chip 選択した時点で破棄)

### 3.3 display in `/calendar/[date]` EntryDetail

Q3 Section 内で:
- **chip 選択**: `「{chip text}」` 表示、subtle chip-like visual(border + padding small)
- **text 入力**: 既存通り `whitespace-pre-wrap` で本文表示
- **両方 null**(空 entry 等): 「記録なし」(既存)
- **既存 free text entries(ADR-014 期)**: text のみ存在、上記 text 入力 path で自然に表示

---

## 4. Architecture

### 4.1 修正 / 新規ファイル

| 種別 | path | 内容 |
|---|---|---|
| 新規 | `app/today/_components/ChipWithTextEscape.tsx` | hybrid input component、QuestionFlow から render |
| 修正 | `lib/constants/template.ts` | BASIC_TEMPLATE Q3 を input_type 変更 + chips array 追加 |
| 修正 | `lib/types.ts` | Question type に `chips?: string[]` field 追加、InputType に `"chip_with_text"` 追加 |
| 修正 | `app/today/_components/QuestionFlow.tsx` | Q3 step で ChipWithTextEscape を render(input_type 分岐) |
| 修正 | `lib/server-actions/entries.ts` | SubmitEntryInput の `tomorrowMessage` を optional 化 + `tomorrowChip` 追加、answers insert で chip / text 分岐 |
| 修正 | `app/calendar/[date]/page.tsx` | EntryDetail Q3 Section に chip / text 分岐 display |

### 4.2 既存コードへの影響(touch しない)

- `components/MoonPhase.tsx`、`CallbackCard.tsx`、`BloomMoon.tsx`、`AppHeader.tsx`
- `components/MoodInput.tsx`、`FreeTextInput.tsx`(Q2 用、touch しない)
- `components/ProgressDots.tsx`(3 step 維持)
- `lib/server-actions/callback.ts`、`ai-followup.ts`、`auth.ts`
- `lib/ai/` 全般
- DB schema(`answers.value_choice` + `value_text` 既存、両方 nullable)
- `supabase/migrations/` 追加なし

### 4.3 既存 entries 互換

- v0 era(`short_choice` で `value_choice` 使用)→ 既に ADR-014 で free text に migrate 済み、Q3 entries は `value_text` のみ
- ADR-014 期(`free_text` で `value_text` のみ)→ そのまま、display で text path
- 本 spec 後(`chip_with_text` で `value_choice` or `value_text`)→ display で分岐

Migration 不要(DB schema 維持、code level の分岐のみ)。

---

## 5. Data Flow

### 5.1 submit(chip 選択 case)

```
1. user が Q3 step で chip 選択 → 「つぎへ」 → 確認画面 → 「保存する」
   ↓
2. QuestionFlow state: tomorrowChip = "明日もがんばる"、tomorrowMessage = ""
   ↓
3. submitEntry({ date, bodySensation, freeText, tomorrowChip, ... aiFields })
   ↓
4. entries.ts:
   - Q3 行 = { pos 3, value_choice: tomorrowChip, value_text: null }
   - (chip と text は排他)
   ↓
5. DB に answers 4 行 insert(Q1 体感 / Q2 text / AI follow-up pos 4 / Q3 chip)
   ↓
6. /today/done(bloom)へ
```

### 5.2 submit(text escape case)

```
1. user が「自由に書く」展開 → text 入力 → 「つぎへ」 → 確認 → 「保存」
   ↓
2. QuestionFlow state: tomorrowChip = null、tomorrowMessage = "..."
   ↓
3. submitEntry({ date, bodySensation, freeText, tomorrowMessage, ... aiFields })
   ↓
4. entries.ts:
   - Q3 行 = { pos 3, value_choice: null, value_text: tomorrowMessage }
   ↓
5. DB に answers 4 行 insert(Q3 = text path)
   ↓
6. /today/done へ
```

### 5.3 display 互換

```
EntryDetail で Q3 = answers.find(a => a.question_position === 3):
  if (q3.value_choice)   → chip-like 表示「明日もがんばる」
  elif (q3.value_text)   → text 表示(whitespace-pre-wrap)
  else                   → 「記録なし」
```

---

## 6. Component spec

### 6.1 ChipWithTextEscape.tsx

```typescript
interface Props {
  chips: string[];           // template 由来、4 個想定
  /** chip 選択時の current value、未選択は null */
  selectedChip: string | null;
  /** text escape mode の current value、escape 未入力は "" */
  textValue: string;
  onChipSelect: (chip: string) => void;
  onTextChange: (text: string) => void;
  /** mode 切替を親に通知(state は親で集約) */
  onModeToggle: (mode: "chip" | "text") => void;
  /** "chip" | "text" のどちらが active か */
  mode: "chip" | "text";
}
```

state は親(QuestionFlow)で集約、本 component は presentation + UI event 通知のみ。

### 6.2 template.ts BASIC_TEMPLATE Q3 改修

```typescript
{
  position: 3,
  text: "明日の自分にひとことだけ",
  input_type: "chip_with_text",  // 新規 input_type
  placeholder: "思ったままに",
  options: ["明日もがんばる", "ゆっくり眠る", "今日はここまで", "そのままで"],
}
```

`options` field は既存 Question type が `MoodOption[] | string[]` で受けるので type 拡張不要、`string[]` として使う。

### 6.3 types.ts InputType 拡張

```typescript
export type InputType =
  | "mood_5"
  | "scale_5"
  | "rating_4"
  | "short_choice"
  | "free_text"
  | "chip_with_text"; // 新規
```

---

## 7. Implementation Scope

### In scope(本 spec)

- ADR-023(別 doc、本 spec と parallel 起草)
- `lib/types.ts` InputType 拡張
- `lib/constants/template.ts` BASIC_TEMPLATE Q3 改修
- `app/today/_components/ChipWithTextEscape.tsx` 新規
- `app/today/_components/QuestionFlow.tsx` Q3 step 分岐(input_type で render 切替)
- `lib/server-actions/entries.ts` SubmitEntryInput + answers insert 分岐
- `app/calendar/[date]/page.tsx` EntryDetail Q3 display 分岐
- `docs/SPEC.md` Q3 section update(別 spec-keeper dispatch、本 plan には含めない)

### Out of scope(future)

- chip text の user customization(v1.1+)
- chip text の i18n / 多言語化
- 既存 entries の `value_text` → `value_choice` migration(意味的にも望ましくない、text として残す)
- chip 追加 / 削除動線(template 編集 = code change、user UI なし)
- text escape mode の word count limit
- chip 選択回数の統計表示(「今月『ゆっくり眠る』5 回」等)

---

## 8. Testing

CLAUDE.md「v0 はテストなし、v1.0 launch 前に Playwright 導入」方針に従い **自動テストなし**。

手動 smoke:
- [ ] /today で Q3 step に到達 → 4 chip 表示
- [ ] chip tap → highlighted、「つぎへ」活性化
- [ ] 他 chip tap → 選択切替
- [ ] 「自由に書く」tap → chips fade、textarea 表示
- [ ] textarea 入力 → 「つぎへ」活性化
- [ ] 「← chip に戻る」tap → chips 復帰、textarea fade
- [ ] chip 選択で submit → DB の Q3 行に `value_choice` set、`value_text` null
- [ ] text 入力で submit → DB の Q3 行に `value_text` set、`value_choice` null
- [ ] /calendar/[今日] で chip 選択 entry を見る → 「明日もがんばる」表示
- [ ] /calendar/[既存 free text entry] を見る → 既存通り text 表示(regression なし)
- [ ] /calendar/[date]?edit=1 で chip 選択 entry → 既存 chip prefill、変更可

---

## 9. Open Questions(実装中に解消)

- mode 切替時の animation:fade in/out の duration(WORLDVIEW MOTION YES list の `bloom` / `fade-in-soft` 流用?)
- chip 選択時の visual:`bg-primary-500` filled vs `border-primary-500 + bg-primary-50` outlined ─ 実装時に Pencil で軽くモック比較
- 「自由に書く」link の visual hierarchy:chip と同じ目立ち度?or subtle 化(`text-sm text-neutral-500 underline` 等)
- chip text の Pencil component-library への追加(/design/hoshifumi.pen):本 spec scope 外、後日デザイン作業時に
- mobile での chip grid 配置:4 個 = 2x2 grid?vertical stack?─ DESIGN.md §5 のコンテナ規則に従う

---

## 10. References

- ブレスト履歴:本セッション 2026-05-19、Phase 0 Day 2 owner 自己観察起点
- ADR-014:Q3 を `short_choice` から `free_text` に変更(本 spec が partial supersede 対象)
- ADR-023:本 spec 成立のための新 ADR(parallel 起草)
- ADR-012:AI follow-up question(Q2 / Q3 の中間 step、本 spec の前提)
- ADR-019:worldview(chip text 選定の YES list 基準)
- 既存コード:`app/today/_components/{QuestionFlow,MoodInput,FreeTextInput}.tsx`、`lib/constants/template.ts`、`lib/server-actions/entries.ts`、`app/calendar/[date]/page.tsx`
