# 追加テンプレート(仕事 / 子育て / つくる / 感謝)─ Design

> Status: **承認待ち**(オーナーレビュー後 writing-plans へ)
> 日付: 2026-05-21
> 関連: CLAUDE.md「Template は v1.0 で TS 定数 + discriminated union、DB table は v1.1+」/ ADR-011(5分儀式フロー)/ ADR-013(Q1 体感)/ ADR-014・023(Q3)/ ADR-019(worldview)
> ブレスト履歴: 本セッション 2026-05-21
> v1.0 sub-project D(decompose は 2026-05-18 セッション)

---

## 1. Overview

現状 `basic` テンプレ 1 種のみ。文脈別の 4 テンプレ(仕事 / 子育て / つくる / 感謝)を追加し計 5 種に。テンプレ間で変わるのは **Q2 の文言のみ**(Q1 体感タップ・Q3 chip は全テンプレ共通、3-beat ritual は固定)。

選択方式は **sticky last-used**:`/today` は直近 entry の `template_name` を default 採用、step 0(Q1 画面)でのみ inline 切替可。`entries.template_name` 列は既存、DB migration 不要。

CLAUDE.md 準拠:テンプレは `lib/constants/template.ts` の TS 定数 + `template_name` discriminated union、DB-backed templates は custom template(v1.1+)まで作らない。

---

## 2. Context と決定の経緯(ブレスト要約)

| 決定点 | 採用 | 理由 |
|---|---|---|
| テンプレが変えるもの | **(i) Q2 文言のみ** | 3-beat ritual(体感→今日→明日)は core rhythm(ADR-011/013/014/023)、テンプレ別にバラけると統一感喪失。AI follow-up は Q2 文言追従で自動文脈化 |
| ラインナップ | basic + 仕事 / 子育て / つくる / 感謝(計 5) | NEXT-ACTIONS の 3 案 + owner 追加の「感謝」 |
| 選択方式 | **(c) sticky last-used** | 毎日選ぶ friction なし、変えたい日だけ切替、`entries.template_name` だけで完結・migration 不要 |
| 切替 UI 位置 | /today step 0(Q1 画面)inline 展開 | Q2 進入後はテンプレ依存の文言で回答済 → orphan 防止のため step 0 限定 |

worldview 観点:
- 内部 name は英語 kebab、表示名は日本語やわらか和語(「親」より「子育て」、「クリエイター」より「つくる」)─ ADR-019 のトーン、production verb / カタカナ職業名を避ける
- 「感謝」は寝る前・受容的な worldview と高相性

---

## 3. テンプレート定義

| name(内部 ID)| 表示名 | description | Q2 text | Q2 placeholder |
|---|---|---|---|---|
| `basic` | (無印・「ほしふみ」)| 体・できごと・明日へ | 今日いちばん印象に残ったこと | ひとことでも、ふたことでも |
| `work` | 仕事 | 仕事の一日を置く | 今日の仕事で、心に残ったこと | うまくいったことも、そうでないことも |
| `parenting` | 子育て | 子どもとの一日を置く | 今日の子どもとのこと | 小さなことでも |
| `making` | つくる | つくる一日を置く | 今日つくったもの、つくれなかったもの | かたちにならなくても |
| `gratitude` | 感謝 | ありがたみを置く | 今日、ありがたかったこと | 誰かのことでも、何かのことでも |

**全テンプレ共通**:
- Q1:「いまの体の感じは?」`mood_5`、`BODY_SENSATION_OPTIONS`(ADR-013)
- Q3:「明日の自分にひとことだけ」`chip_with_text`、chip 4 種(ADR-023)
- AI follow-up(Q2 と Q3 の間、ADR-012):prompt 改修なし、Q1+Q2 を読むので Q2 文言が変われば文脈追従

Q2 text / placeholder の最終文言は実装時に微調整可、上記は方向性。

---

## 4. User Experience

### 4.1 /today でのテンプレ表示・切替

```
[AppHeader]
{M月d日(E)}
今日のほしふみ、はじめよう

┌ 仕事 ▾ ┐                  ← step 0(Q1)でのみ表示、現在テンプレ
└─────────┘

[Q1 体感タップ(MoonInput)]
[つぎへ]
```

`仕事 ▾` を tap → inline 展開:

```
┌──────────────────────────┐
│ ほしふみ   体・できごと・明日へ  │
│ 仕事 ✓     仕事の一日を置く      │
│ 子育て     子どもとの一日を置く  │
│ つくる     つくる一日を置く      │
│ 感謝       ありがたみを置く      │
└──────────────────────────┘
```

- 5 行リスト、各行 = 表示名 + description、現在選択に ✓
- 1 つ tap → 展開閉じる、選択テンプレに切替、Q2/Q3 文言がそのテンプレのものに
- step 0(Q1)でのみ操作可。step 1(Q2)以降は switcher 非表示(locked)

### 4.2 default の決まり方(sticky last-used)

```
/today を開く
  → 直近の完了 entry(completed_at NOT NULL、entry_date DESC 最初)を取得
  → その template_name を default に
  → 完了 entry が無い(初回)→ "basic"
```

例:昨日「仕事」で書いた → 今日 /today は「仕事」default。変えたい日だけ step 0 で切替。

### 4.3 編集モード(/calendar/[date]?edit=1)

- その entry 自身の `template_name` を使う(last-used ではなく entry 固有)
- テンプレ切替 **不可**(既存 Q2 回答がそのテンプレの問いに対応済、切替は orphan を生む)
- switcher 非表示

### 4.4 /calendar/[date] detail 表示

- EntryDetail の Q2 Section label を、entry の template の Q2 text に(現状 hardcode「今日いちばん印象に残ったこと」を template 参照に)
- 例:仕事 entry を見ると Q2 Section label =「今日の仕事で、心に残ったこと」

---

## 5. Architecture

### 5.1 修正 / 新規ファイル

| 種別 | path | 内容 |
|---|---|---|
| 修正 | `lib/constants/template.ts` | `BASIC_TEMPLATE` 単体 → `TEMPLATES` record(5 種)+ `getTemplate(name)` helper + `TEMPLATE_LIST`(表示順) |
| 修正 | `lib/types.ts` | `TemplateName` union type(`"basic" \| "work" \| "parenting" \| "making" \| "gratitude"`)追加、`Template.name` を narrow |
| 新規 | `app/today/_components/TemplateSwitcher.tsx` | inline 展開の picker、presentation |
| 修正 | `app/today/page.tsx` | 直近 entry の template_name 取得 → QuestionFlow に `initialTemplateName` 渡す |
| 修正 | `app/today/_components/QuestionFlow.tsx` | `initialTemplateName` prop、template state、step 0 に TemplateSwitcher、選択 template の questions 使用 |
| 修正 | `lib/server-actions/entries.ts` | `submitEntry` が `templateName` を受け entries.template_name に保存(現状 'basic' hardcode) |
| 修正 | `app/calendar/[date]/page.tsx` | EntryDetail が entry の template の Q2 text を Section label に |

### 5.2 template.ts の新構造

```typescript
export type TemplateName = "basic" | "work" | "parenting" | "making" | "gratitude";

// 全テンプレ共通の Q1 / Q3 を組み立てる helper(DRY)
function buildQuestions(q2Text: string, q2Placeholder: string): Question[] {
  return [
    { position: 1, text: "いまの体の感じは?", input_type: "mood_5", options: BODY_SENSATION_OPTIONS },
    { position: 2, text: q2Text, input_type: "free_text", placeholder: q2Placeholder },
    { position: 3, text: "明日の自分にひとことだけ", input_type: "chip_with_text", placeholder: "思ったままに", options: [...] },
  ];
}

export const TEMPLATES: Record<TemplateName, Template> = {
  basic:      { name: "basic",      displayName: "ほしふみ", ... },
  work:       { name: "work",       displayName: "仕事", ... },
  parenting:  { name: "parenting",  displayName: "子育て", ... },
  making:     { name: "making",     displayName: "つくる", ... },
  gratitude:  { name: "gratitude",  displayName: "感謝", ... },
};

// 表示順(switcher の並び)
export const TEMPLATE_LIST: TemplateName[] = ["basic", "work", "parenting", "making", "gratitude"];

export function getTemplate(name: string): Template {
  return TEMPLATES[name as TemplateName] ?? TEMPLATES.basic; // 不明 name は basic fallback
}
```

`Template` type に `displayName: string` を追加(内部 name と表示名の分離)。既存 `BASIC_TEMPLATE` を import している箇所(QuestionFlow / calendar 等)は `getTemplate()` 経由に書き換え。

### 5.3 既存コードへの影響

- `components/MoonPhase.tsx`、`MoodInput.tsx`、`FreeTextInput.tsx`、`ChipWithTextEscape.tsx`、`ProgressDots.tsx`、`AIQuestionStep.tsx`:変更なし(Q の中身に依存しない)
- `lib/server-actions/callback.ts`、`ai-followup.ts`:変更なし(AI は Q1+Q2 の値だけ読む、template 構造に非依存)
- `lib/utils/streak.ts`、`lib/ai/`:変更なし
- DB schema(`entries.template_name` 既存 default 'basic'、`answers` pos 固定):変更なし、migration 不要

### 5.4 既存 entries 互換

- 既存 entries は全て `template_name = 'basic'`(v0 から現在まで)
- `getTemplate('basic')` で従来通り解決、display も従来通り
- 新テンプレ entries は `work` / `parenting` 等の name で保存、`getTemplate` で解決

---

## 6. Data Flow

```
1. /today を開く(server component)
   ↓
2. 直近完了 entry を取得(entries where completed_at NOT NULL, order entry_date DESC, limit 1)
   ↓
3. その template_name(なければ "basic")を initialTemplateName として QuestionFlow に渡す
   ↓
4. QuestionFlow:template state = initialTemplateName、getTemplate() で questions 解決
   ↓
5. step 0(Q1)で TemplateSwitcher 表示、user が切替したら template state 更新 → Q2/Q3 文言が再 render
   ↓
6. step 1 以降 switcher 非表示、選択 template の questions[step] で進行
   ↓
7. submit:submitEntry({ ..., templateName: <選択 template> })
   ↓
8. entries.template_name に保存(upsert)
   ↓
9. 既存 redirect 分岐(/today/done or /calendar/[date])
```

編集モード(/calendar/[date]?edit=1)は step 5 をスキップ(initialEntry.template_name 固定、switcher 非表示)。

---

## 7. Component spec

### 7.1 TemplateSwitcher.tsx

```typescript
interface Props {
  current: TemplateName;
  onSelect: (name: TemplateName) => void;
}
```

- collapsed 状態:`{displayName} ▾` の tappable row
- expanded 状態:`TEMPLATE_LIST` 順に 5 行、各行 displayName + description、current に ✓
- state(open/closed)は component 内 local、選択は親(QuestionFlow)に `onSelect` 通知
- `▾` は記号文字(絵文字でない)、worldview OK

### 7.2 QuestionFlow.tsx の変更点

- 新 prop:`initialTemplateName: TemplateName`
- 新 state:`const [templateName, setTemplateName] = useState(initialTemplateName)`
- `questions` を `getTemplate(templateName).questions` から取得(現状 `BASIC_TEMPLATE.questions` 直参照を置換)
- step 0 の render に `<TemplateSwitcher current={templateName} onSelect={setTemplateName} />` を追加(編集モード = `initialEntry` あり時は非表示)
- `handleSubmit` の `submitEntry` 呼び出しに `templateName` 追加

---

## 8. Implementation Scope

### In scope(本 spec)

- `lib/types.ts` `TemplateName` union + `Template.displayName`
- `lib/constants/template.ts` `TEMPLATES` record(5 種)+ `getTemplate` + `TEMPLATE_LIST` + `buildQuestions` helper
- `app/today/_components/TemplateSwitcher.tsx` 新規
- `app/today/page.tsx` 直近 entry の template_name 取得 → QuestionFlow に渡す
- `app/today/_components/QuestionFlow.tsx` template state + switcher + getTemplate 連携
- `lib/server-actions/entries.ts` `submitEntry` の templateName 受け取り + 保存
- `app/calendar/[date]/page.tsx` EntryDetail Q2 label を template 参照に
- `docs/SPEC.md` テンプレ section update(別 spec-keeper dispatch、本 plan 外)

### Out of scope(future)

- custom template 作成 UI(v1.1、DB-backed templates)
- onboarding での初回テンプレ選択 UI(sub-project E、別 spec)
- profiles への default_template 列(sticky last-used で不要)
- template ごとの Q3 chip 出し分け
- template ごとの AI prompt 改修
- template ごとの Q 数 / 構造変更(3-beat 固定)
- template の並べ替え / お気に入り
- 過去 entries の template 一括変更

---

## 9. Testing

CLAUDE.md「v0 はテストなし、v1.0 launch 前 Playwright」方針に従い **自動テストなし**。typecheck + build は各 task 必須。機能検証は Vercel 本番 deploy 後に実施(dev smoke は省略)。

本番 smoke:
- [ ] /today で TemplateSwitcher 表示、現在テンプレ(初回 basic)
- [ ] switcher tap → 5 テンプレ展開、選択 → Q2 文言が変わる
- [ ] 仕事 テンプレで submit → /today/done
- [ ] 翌日 /today → 仕事 が default(sticky last-used 動作)
- [ ] Q2 進入後は switcher 非表示
- [ ] /calendar/[仕事 entry] → Q2 Section label が「今日の仕事で、心に残ったこと」
- [ ] /calendar/[既存 basic entry] → 従来通り表示(regression なし)
- [ ] /calendar/[date]?edit=1 → switcher 非表示、entry 固有 template で表示

---

## 10. Open Questions(実装中に解消)

- TemplateSwitcher の展開 animation(fade / 高さ animation、MOTION.md 準拠)
- switcher collapsed の visual:chip 風(border + rounded)か text + ▾ か、実装時に軽くモック
- basic の displayName:「ほしふみ」か「無印」か「きほん」か ─ 実装時に worldview-keeper 観点で確定(spec では仮「ほしふみ」)
- description 文言の最終調整(「〜を置く」の統一トーン)
- /today/done に template 名を出すか(現状案:出さない、bloom + streak に集中)

---

## 11. References

- ブレスト履歴:本セッション 2026-05-21
- CLAUDE.md:Template hardcode 方針(v1.0 TS 定数、v1.1+ DB-backed)
- ADR-011:5 分儀式フロー / ADR-013:Q1 体感 / ADR-014・023:Q3 / ADR-019:worldview
- 既存コード:`lib/constants/template.ts`、`lib/types.ts`、`app/today/page.tsx`、`app/today/_components/QuestionFlow.tsx`、`lib/server-actions/entries.ts`、`app/calendar/[date]/page.tsx`
- v1.0 decompose:2026-05-18 セッション(D = 追加テンプレート、E = オンボーディング)
