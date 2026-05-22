# AI Follow-up 深堀り(multi-turn)+ 質問品質改善 ─ Design

> Status: **実装完了**(2026-05-23)
> 日付: 2026-05-23
> 関連 ADR: ADR-012(AI follow-up question)/ ADR-016(AI は引用係)/ ADR-019(worldview)/ ADR-021(Gemini)/ **ADR-024(新規・要起票)**
> 関連 spec: `docs/specs/2026-05-18-ai-followup-question-design.md` ── 本 spec はその §1「v1.0 = single turn」を一部 supersede する
> ブレスト履歴: 本セッション 2026-05-23

---

## 1. Overview

稼働中の AI follow-up step に対し、オーナーのセルフテスト所感を起点に4点を改修する。

| # | 要望 | 現状 | 本 spec の対応 |
|---|---|---|---|
| 1 | 質問品質 ── 中身のない問いを出す | 旧 system prompt | system prompt + few-shot を全面書き換え。2レジスター化 + 空質問ガード |
| 2 | 深堀り(multi-turn)── 1問1答が軽い | single-turn 固定 | 適応的 multi-turn 化(合計最大3問) |
| 3 | 保存前の確認画面に AI の問いを出す | 確認カードは体/出来事/明日のみ | 既存確認カードに AI 対話セクション追加 |
| 4 | AI の問いの保存・表示 | single-turn 分は実装済み | multi-turn 対応で作り直し |

実質の重量物は **#2** で、#3 #4 はその派生。#1 は独立だが #2 と prompt を共有するため同一 spec に束ねる。

### 起点となった具体ケース

Q2 に「おやすみだから最高。」と書いたところ、AI が「最高と思ったのはあなた?」と返した。書き手は本人しかいないので主語を問う意味がなく、答えても何も開かない空の問い。原因は、旧 prompt の few-shot 3例がすべて「ひっかかりのある重い日」で、軽い・短い・着地したエントリのレジスターを AI が持っていなかったこと。掘る材料がないのに掘る動作を強制された結果の破綻。

---

## 2. 背景・経緯(ブレスト要約)

| 決定点 | 採用 | 理由 |
|---|---|---|
| 質問品質の直し方 | prompt 全面書き換え(否定リスト追加だけにしない) | 既存「絶対にしない」リストも守りきれていない。最適化ターゲットを「形を満たす」から「答えると何かが開く」へ移す必要 |
| 軽い日の扱い | quote-back は維持、問いの幅と軽い日レジスターを足す | オーナー合意。掘る/味わう の2レジスター。「軽い日は AI が問わず素通り」案は不採用(quote-back の枠内で味わう問いを返す方が儀式として自然) |
| 深堀りの深さ | 適応的 multi-turn、合計最大3問(初問 + 深堀り最大2回) | 1問1答の体験が薄いというオーナー所感。余地があれば追加で問い、なければ1問で切り上げる |
| multi-turn の継続判断 | AI が毎ターン構造化出力で ask/close を返す | サーバー側ヒューリスティックより、対話全体を読んだ AI の判断のほうが「閉じてるか」を捉えられる |
| データモデル | `answers` の pos 4,5,6 に AI ターンを展開 | 多列構造(JSON 化しない方針)維持、新テーブル不要。専用テーブルは CLAUDE.md「テーブル早すぎ追加しない」に照らし過剰 |
| 確認画面 | 既存の確認カードに AI 対話行を追加(新ステップは作らない) | 確認画面は `QuestionFlow.tsx:152-195` に既存。儀式に操作を足さない |

---

## 3. #1 プロンプト改修

`lib/ai/prompts/follow-up.ts` の `FOLLOW_UP_SYSTEM_PROMPT` を multi-turn 対応で全面書き換え。

### 3.1 新 system prompt

```
あなたは寝る前のジャーナリングを読み、書き手自身の言葉を引用して問い返す役割。
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
前置き・説明・コードフェンスを付けない。
```

旧 prompt からの変更点:

1. **「良い問いとは」を新設** ── 最適化ターゲットを「引用 + 疑問詞という形」から「答えると何かが開くこと」へ移す。これが核。
2. **2レジスターを明文化** ── 重い日は掘る、軽い日は留まる。「掘る材料がない日に無理に作らない」を明記。
3. **「絶対にしない」に4行追加** ── 主語 / はい・いいえ / 既出の答え / 事実。起点ケースが落ちた4つの穴を塞ぐ。
4. **フレーズ選択を縛る** ── 「事実部分ではなく気持ちがにじむ部分を選べ」。
5. **continuation 節 + JSON 出力** ── multi-turn 対応(§4)。

### 3.2 新 few-shot

旧3例(重い日のみ)を、JSON 出力 + 対話継続を示す形に作り直し、軽い日・空の日を加える。few-shot は **3本の会話**:

**会話A(重い日・2往復して閉じる)**
```
user:  Q1(体感):重たい
       Q2(今日のこと):会議で〇〇さんに言われた一言が、まだ引っかかってる。
model: {"action":"ask","question":"「一言が、まだ引っかかってる」って、その引っかかりはどこからきてる?"}
user:  自分でも気にしすぎだと思うけど、否定された気がした。
model: {"action":"ask","question":"「否定された気がした」って、その"気がした"のほう、もう少し聞かせて?"}
user:  たぶん、ちゃんとやってるって認めてほしかった。
model: {"action":"close"}
```

**会話B(軽い日・1問で閉じる ── 起点ケースの正解例)**
```
user:  Q1(体感):軽やか
       Q2(今日のこと):おやすみだから最高。
model: {"action":"ask","question":"「最高」って、今日のどのへんが一番そう?"}
user:  ふとんに入った瞬間。あったかくて。
model: {"action":"close"}
```

**会話C(空の日・1問で閉じる)**
```
user:  Q1(体感):ふつう
       Q2(今日のこと):特に何もない、ふつうの一日だった。
model: {"action":"ask","question":"「ふつうの一日」のなかで、ひとつだけ覚えてる小さなことは?"}
user:  帰り道の月がきれいだった。
model: {"action":"close"}
```

会話B が起点ケースそのものを正解例として埋め込む(直接の予防接種)。会話A が「掘る」レジスターと2往復継続、B/C が「味わう」レジスターと1問 close を AI に教える。

### 3.3 Gemini 設定

- `model: "gemini-2.0-flash"`(変更なし)
- `temperature: 0.4`(変更なし ── 問いの幅は prompt と few-shot で広げる、temperature はいじらない)
- `maxOutputTokens: 150`(JSON 化で微増、100 → 150)
- `topP: 0.9`(変更なし)
- `responseMimeType: "application/json"` + `responseSchema`(§5)を新規付与

---

## 4. #2 Multi-turn 深堀り ── 挙動

### 4.1 フロー

```
[Q2 submit]
   ↓
[AI step:初問を生成 → 表示 → ユーザー回答]
   ↓
[AI が対話全体を読んで判断]
   ├─ ask  → 次の問いを表示 → ユーザー回答 → (再判断)
   └─ close → AI step 終了
   ↓ (合計3問に達したら強制終了)
[Q3 へ]
```

- **ハードキャップ:合計3問**(初問 + 深堀り最大2回)。サーバー側で対話履歴の長さを見て、3問完了済みなら AI を呼ばずに close 扱い。
- 軽い日・空の日は few-shot と prompt により大半が1問で close。重い日が2〜3問。
- ユーザー側の手動 skip / 早期終了ボタンは v1.0 では出さない(既存 spec の posture 踏襲、§9 out of scope)。

### 4.2 失敗時の挙動(turn 別)

| 状況 | 挙動 |
|---|---|
| 初問の生成が失敗(retry 後も) | 従来どおり **silent skip**。AI 行を1つも保存せず、Q3 prompt 上に「今夜は静かに進みます」 |
| 2問目以降の生成が失敗 | **graceful close**。すでに回答済みの対話は保持したまま AI step を閉じ Q3 へ。「静かに進みます」は出さない(対話は成立しているため) |
| 2問目以降で空・不正な JSON | graceful close(初問の空応答だけは silent skip = 従来どおり) |

「途中まで対話した分を失わない」が原則。

---

## 5. #2 派生 ── `lib/ai/` 構造化出力 + Server Action

### 5.1 `lib/ai/` 構造化出力パス

現状 `chat()` はプレーンテキストを返す。AI に毎ターン `ask`/`close` を判断させるため、構造化出力(JSON)パスを追加する。

- `lib/ai/types.ts`:`ChatRequest` に `responseSchema?` を追加、構造化レスポンス型を定義
- `lib/ai/providers/gemini.ts`:`responseMimeType: "application/json"` + `responseSchema` を渡し、parse 済みオブジェクトを返す経路を実装
- `lib/ai/providers/anthropic.ts`:stub のまま(v1.1+)

出力スキーマ:
```jsonc
{
  "type": "object",
  "properties": {
    "action":   { "type": "string", "enum": ["ask", "close"] },
    "question": { "type": "string" }   // action="ask" のときのみ意味を持つ
  },
  "required": ["action"]
}
```

> この構造化出力パスは v1.1 月次レポート(SPEC §9 で「curation primitive を出す構造化出力」へ作り直す予定)でも再利用できる。今足す投資はそこで回収される。

### 5.2 `lib/server-actions/ai-followup.ts`

`generateFollowUpQuestion()` の signature を対話履歴を受け取る形へ変更:

```typescript
export interface FollowUpTurn {
  question: string;   // AI の問い
  answer: string;     // ユーザーの回答
}

export interface FollowUpInput {
  bodySensationLabel: string;
  freeText: string;             // Q2
  dialog: FollowUpTurn[];       // これまでの Q&A。初回呼び出しは空配列
}

export type FollowUpOutcome =
  | { question: string }        // 次の問い(ask)
  | { done: true }              // 対話終了(AI が close、またはキャップ到達)
  | { error: FollowUpErrorCode };

export async function generateFollowUpQuestion(
  input: FollowUpInput,
): Promise<FollowUpOutcome>;
```

サーバー側ロジック:

1. `input.dialog.length >= 3` → AI を呼ばず `{ done: true }`(キャップ)
2. `lib/ai/prompts/follow-up.ts` の `buildFollowUpMessages(input)` で few-shot + 初問 user message + 対話履歴(model JSON / user answer の交互)を組み立て
3. `lib/ai/chat()` を構造化出力で呼ぶ(retry / timeout は従来どおりここで吸収)
4. `action="ask"` かつ question 非空 → `{ question }`
5. `action="close"` → `{ done: true }`
6. 失敗 / 空応答:`dialog` が空(初問)なら `{ error }`、非空なら `{ done: true }`(graceful close、§4.2)

### 5.3 `lib/ai/prompts/follow-up.ts` builder

`buildFollowUpMessages(input: FollowUpInput): Message[]`:
- `FOLLOW_UP_FEW_SHOTS`(§3.2 の3会話)を展開
- 初問 user message(Q1 + Q2)
- `input.dialog` の各ターンを `{role:"model", content: JSON.stringify({action:"ask",question})}` → `{role:"user", content: answer}` の順で展開

few-shot もこの message 形(model 側は JSON 文字列)で定義し、ライブ呼び出しと shape を一致させる。

### 5.4 `lib/server-actions/entries.ts`

`submitEntry` の入力を multi-turn 対応へ:

- 現状:`aiQuestion?: string` / `aiAnswer?: string`(単一)
- 変更後:`aiTurns?: FollowUpTurn[]`(0件 = skip、1〜3件)

保存処理(現状 `entries.ts:90-96` の pos 4 単一 insert):
- `aiTurns` の各ターン `i`(0-indexed)を `question_position = 4 + i` で insert
- 各行:`question_text` = AI の問い、`value_text` = ユーザー回答
- `aiTurns` が空なら AI 行を insert しない(silent skip)

`submitEntry` は内部 action で呼び出し元は `QuestionFlow` のみ。input 型変更の影響範囲は閉じている。

---

## 6. #2 派生 ── データモデル

### 6.1 現状

`answers.question_position` の CHECK 制約は `answers_question_position_check`、現在 `between 1 and 5`(`supabase/migrations/20260517000000_callback_state.sql:20-22`)。pos 4 = AI follow-up 単一行。

### 6.2 変更

cap 3 → AI ターンは pos 4,5,6。CHECK を緩める。新規 migration:

```sql
-- supabase/migrations/2026XXXXXXXXXX_ai_multiturn.sql
alter table answers
  drop constraint answers_question_position_check,
  add constraint answers_question_position_check
    check (question_position between 1 and 8);
```

- 上限 8 はヘッダルーム(将来の cap 引き上げ余地)。
- pos 1=Q1 / 2=Q2 / 3=Q3 は不変。pos 4,5,6 = AI ターン(対話順)。
- RLS / index 変更なし(`answers` の既存 RLS は entry 経由、position に依存しない)。

### 6.3 `EntryWithAnswers` 再構成

`answers` を読む側は `find(pos === 4)` → `filter(pos >= 4).sort(by pos)` へ。
`lib/types.ts` に AI 対話を表す派生フィールド(現状 `aiQuestion` / `aiAnswer` 相当)があれば `aiTurns: FollowUpTurn[]` へ置換。実装時に参照箇所を audit。

Phase 0 / single-turn 期の既存 entry は pos 4 が1行だけ ── `filter(pos>=4)` は要素1の配列を返すので後方互換、migration 不要。

---

## 7. #2 UX ── `AIQuestionStep.tsx` のループ化

現状 `AIQuestionStep` は `useEffect` で1回だけ生成 → 1問表示 → `onComplete(question, answer)`。これをループ化する。

### 7.1 内部 state

```
turns:           FollowUpTurn[]          // 確定した Q&A
currentQuestion: string | null           // 表示中の問い
phase:           "loading" | "answering"
```

### 7.2 進行

1. mount → `generateFollowUpQuestion({ ..., dialog: [] })`、`phase="loading"`(breath animation +「ひと呼吸…」)
2. `{ question }` → `currentQuestion` 表示、textarea 表示(`phase="answering"`)
3. `{ error }`(初問のみ起こりうる) → `onComplete([])`(silent skip)
4. ユーザーが回答 submit → `turns` に `{ currentQuestion, answer }` を push → `phase="loading"` → `generateFollowUpQuestion({ ..., dialog: turns })`
5. `{ question }` → 次の問いを表示(2 に戻る)
6. `{ done: true }` → `onComplete(turns)`
7. `{ error }`(2問目以降) → `onComplete(turns)`(graceful close、これまでの turns を保持)

### 7.3 `onComplete` signature 変更

```typescript
// 変更前: onComplete(aiQuestion: string | null, aiAnswer: string | null)
// 変更後:
onComplete(turns: FollowUpTurn[]): void   // 空配列 = silent skip
```

### 7.4 UI

- 問い card は既存 spec §3.3(`bg-primary-50` highlighted card、italic 寄り)を踏襲。各ターンで同じ shape の card を出すだけ。
- **ターン番号 / 進捗カウンタは出さない**(「2問目」表示はクイズ感が出て worldview に反する)。問いが静かに次へ移るだけ。
- ターン間の loading も「ひと呼吸…」+ breath animation を再利用。
- `QuestionFlow.tsx`:`aiStatus` / `handleAIComplete` を turns 配列ベースへ。`aiQuestion`/`aiAnswer` の単一 state を `aiTurns: FollowUpTurn[]` に置換。

---

## 8. #3 確認画面に AI 対話を表示

確認カードは既存(`QuestionFlow.tsx:152-195`、`isComplete` 時に render)。現在は **体 / できごと / 明日へ** の3項目のみで、AI 対話が載っていない。

### 変更

- できごと行と明日へ行の間に「AIとの問い」ブロックを挿入(儀式順:体 → できごと → AI対話 → 明日へ)。
- `aiTurns` の各ターンを 問い(`text-neutral-500` 小)+ 回答(`text-neutral-800`)で列挙。
- `aiTurns` が空(silent skip)のときはブロックごと省略(無音の割り切りと一貫)。
- カード既存の `flex gap-3` + `w-16` ラベル行レイアウトは AI 対話の複数行 Q&A には窮屈なので、AI 対話だけはラベル付きの縦ブロックにする(他項目のレイアウトは変えない)。

「修正する」ボタン(`setStep(0)`)の挙動は変更しない(§11 の既知の割り切り参照)。

---

## 9. #4 カレンダー詳細の multi-turn 対応

`app/calendar/[date]/page.tsx:153-213`。

- 現状:`aiAnswer = answers.find(pos === 4)`、「AI からの問い」Section に単一 Q&A を render。
- 変更:`aiTurns = answers.filter(pos >= 4).sort(by pos)`、Section 内で対話を順にループ描画(問い → 回答 を繰り返し)。
- Phase 0 / single-turn 期 entry は要素1の配列になり、見た目は現状と同じ(後方互換)。
- skip された entry は `aiTurns` 空 → Section ごと非表示(現状の条件分岐踏襲)。

---

## 10. ADR

multi-turn を v1.0 へ入れるのは、spec 2026-05-18 §1 の α 決定「v1.0 = single turn(multi-turn は v2.0+)」および ADR-012「single でスタート」の **スコープ前倒し**。決定の巻き戻しなので新規 ADR を起票する。

- **ADR-024(番号は起票時に確定)**:AI follow-up を v1.0 で multi-turn 化
- DECISIONS.md は append-only かつオーナー管理。本 spec 承認後、ADR-024 の diff をチャットで提案(直接編集しない)。
- ADR-016(引用係原則)とは矛盾しない ── multi-turn でも各問いは引用ベースの問い返しであり、要約・解釈はしない。ADR-024 は ADR-012 を supersede せず「single でスタート」部分のみ改定する旨を明記。

---

## 11. Implementation Scope

### In scope

- `lib/ai/prompts/follow-up.ts`:system prompt + few-shot 全面書き換え、`buildFollowUpMessages` の multi-turn 対応
- `lib/ai/types.ts` / `providers/gemini.ts`:構造化出力(`responseSchema`)パス追加
- `lib/server-actions/ai-followup.ts`:`generateFollowUpQuestion` を対話履歴ベースへ、cap / graceful close ロジック
- `lib/server-actions/entries.ts`:`submitEntry` を `aiTurns[]` 受け取りへ、pos 4〜6 insert
- `app/today/_components/AIQuestionStep.tsx`:ループ化
- `app/today/_components/QuestionFlow.tsx`:`aiTurns` state 化、確認カードに AI 対話ブロック追加
- `app/calendar/[date]/page.tsx`:AI 対話の multi-turn 描画
- `lib/types.ts`:AI 対話派生型を `aiTurns` ベースへ
- 新規 migration:`answers_question_position_check` を `between 1 and 8` へ
- `docs/SPEC.md` §3 / §6:multi-turn フロー・pos 4〜6 へ更新、§6 の古い「pos 4 は表示されない」メモを訂正
- ADR-024 の diff 提案(チャット)

### Out of scope

- ユーザー手動の skip / 早期終了ボタン(v1.1、Phase 1 観察後)
- streaming response(v1.1)
- 4問目以降への cap 引き上げ
- Anthropic provider 実装(stub のまま、v1.1+)
- 月次レポート(別 sub-project、本 spec の構造化出力パスを再利用)
- 確認画面「修正する」後の AI 対話の再生成(§12 参照)
- 過去日 entry に multi-turn を出すか(既存 spec の open question 踏襲)
- 自動テスト(CLAUDE.md 方針どおり手動 smoke のみ)

---

## 12. Testing

CLAUDE.md「v0 はテストなし」方針どおり自動テストなし。手動 smoke + 観察。

手動 smoke:
- [ ] 重い Q2 → 2〜3問の対話 → close → Q3 へ
- [ ] 軽い Q2(「おやすみだから最高。」)→ 1問で close(起点ケースの回帰確認)
- [ ] 空の Q2(「ふつうの一日だった。」)→ 主語/事実/はい・いいえ質問が出ない
- [ ] 確認カードに AI 対話が全ターン表示される
- [ ] 保存後 `answers` に pos 4〜6 が対話順で入る
- [ ] `/calendar/[date]` で AI 対話が全ターン表示される
- [ ] 初問失敗 → silent skip →「今夜は静かに進みます」→ Q3 通過
- [ ] 2問目失敗 → graceful close(1問目の Q&A は保存される)→ Q3 通過
- [ ] cap:3問で必ず Q3 へ進む
- [ ] Phase 0 期の single-turn 既存 entry がカレンダーで壊れず表示される

Phase 1 質的観察:
- [ ] 問いが「中身のない問い」(主語・事実・既出の答え)になっていないか
- [ ] close 判断が早すぎ / しつこすぎないか
- [ ] multi-turn が「問い詰められる」感にならず「もう一歩そっと」の感触か
- [ ] 構造化出力(JSON)が Gemini 2.0 Flash で安定して返るか、parse 失敗頻度

検証は dev 手動テストをスキップし、typecheck / build 通過後 Vercel 本番 deploy で確認(オーナー方針)。

---

## 13. Open Questions

- **確認画面「修正する」後の AI 対話**:「修正する」は `setStep(0)` で先頭へ戻すが、`aiStatus` は `done` のままで Q2 → next() 時に AI step が再実行されない(既存挙動)。multi-turn でも踏襲 = 修正しても古い AI 対話が残る。Q2 を書き換えると対話と齟齬が出るが、本 spec では割り切る(Phase 1 観察、頻発するなら v1.1 で「Q2 変更時は AI 対話を破棄して再実行」を検討)。
- **`responseSchema` の Gemini 2.0 Flash 安定性**:構造化出力の parse 失敗時は §4.2 の graceful close / silent skip に倒すが、頻度は Phase 1 で観察。
- **「ひと呼吸…」コピー**:multi-turn でターン間に複数回出る。連続で見て「待たされ感」が出ないか実装時に目視。
- **cap 3 の妥当性**:「2回くらい」をハードキャップ3問と解釈。Phase 1 で長すぎ/短すぎを観察。

---

## 14. References

- ブレスト履歴:本セッション 2026-05-23
- 先行 spec:`docs/specs/2026-05-18-ai-followup-question-design.md`(本 spec が §1 single-turn 決定を一部 supersede)
- ADR-012:AI follow-up question / ADR-016:AI は引用係 / ADR-019:worldview / ADR-021:Gemini 2.0 Flash
- 既存コード:`lib/ai/prompts/follow-up.ts`、`lib/server-actions/ai-followup.ts`、`lib/server-actions/entries.ts`、`app/today/_components/QuestionFlow.tsx`・`AIQuestionStep.tsx`、`app/calendar/[date]/page.tsx`
- 既存 schema:`supabase/migrations/20260517000000_callback_state.sql`(`answers_question_position_check` = between 1 and 5)
