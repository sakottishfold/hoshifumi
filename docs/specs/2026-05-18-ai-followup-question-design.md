# AI Follow-up Question + `lib/ai/` 基盤 ─ Design

> Status: **承認待ち**(オーナーレビュー後 writing-plans へ)
> 日付: 2026-05-18
> 関連 ADR: ADR-012(AI follow-up question)/ ADR-016(AI は引用係)/ ADR-019(worldview)/ ADR-021(Gemini 2.0 Flash 採用)
> ブレスト履歴: 本セッション 2026-05-18

---

## 1. Overview

寝る前の 5 分儀式に「Q1 体感 → Q2 自由記述 → **AI follow-up question(quote-back)** → Q3 自由記述」フローを実装する。AI 質問は user の Q2 から1フレーズを引用し、それを問い返す形(ADR-016 引用係原則 pure 適用)。

同時に `lib/ai/` 抽象化基盤を構築(ADR-021 Gemini 2.0 Flash 採用、v1.1+ で Anthropic に switch 可能な provider 層)。AI follow-up はこの基盤の最初の consumer であり、v1.1 月次レポートが2番目に再利用する。

α 厳格な前提:
- フロー配置 = **blocking await**(Q2 と Q3 の間、AI 完了まで待つ、worldview「夜の余白」と整合)
- 失敗時 = **auto-retry 1回 + silent skip + soft 1 行コピー**
- 質問 style = **(α) Pure quote-back**(Q2 のフレーズを引用 + 「なぜ?」「どんな?」)
- v1.0 = **single turn**(multi-turn は v2.0+)
- Phase 1 = **owner 単独**、Free / Pro gating 不問

---

## 2. Context と決定の経緯(ブレスト要約)

| 決定点 | 採用 | 理由 |
|---|---|---|
| sub-project scope | **(i) A + B 束ね**(lib/ai/ + follow-up question)| 完結 vertical slice、user-visible、`lib/ai/` を月次レポートと共有 |
| フロー配置 | **(a) Q2 submit 直後 / Q3 前(blocking await)** | ADR-012 素直、線形フロー、Gemini Flash 1-3秒 latency は「夜の余白」と整合 |
| 失敗 fallback | **(iii) auto-retry once + silent skip** | 一過性 network 失敗を救う + worldview「エラー画面で雰囲気壊さない」+ soft 1行コピーで透明性 |
| 質問 style | **(α) Pure quote-back** | ADR-016 引用係純度最高、prompt template simple、出力評価容易 |
| timeout 値 | **8秒**(retry 込み 16秒) | Gemini Flash p99 < 7秒、ハング検知に十分 |

---

## 3. User Experience

### 3.1 成功 path

```
[Q1 体感タップ] → [Q2 自由記述 submit]
   ↓
[Loading state: breath animation + 「ひと呼吸…」]
   ↓ (1-3秒、最大 8秒 await + 1回 retry)
[AI 質問 card 表示 + 入力 textarea]
   ↓ user 回答 submit
[Q3 自由記述 step へ進む]
   ↓
[Q3 submit → /today/done(既存 bloom + callback)]
```

AI 質問 card は「読み専、italic 寄り」、Q2 textarea と同じ shape の textarea で answer 入力。AI 出力は user の Q2 フレーズを引用形「...」で含む。

### 3.2 失敗 path

```
[Q2 submit]
   ↓
[Loading]
   ↓ (timeout 8秒 or error)
[Auto retry 1回]
   ↓ それでも失敗
[silent skip:Q3 prompt 上に小さく「今夜は静かに進みます」1行]
   ↓
[Q3 自由記述 → 通常 submit]
```

retry / fallback は user 操作なし、completely 透明。soft silent = 完全無音じゃなく 1 行 acknowledge で「AI 動こうとして失敗した」感を雰囲気壊さず伝える。

### 3.3 UI 仕様

**Loading state(AI await 中):**
```
[小さい breath animation(scale 1.0 ↔ 1.02、3秒周期、WORLDVIEW.md YES list)]
ひと呼吸…
```
能動的な「待ち」より「儀式的 pause」と framing。

**AI question card + input:**
```
┌─ AI 質問 card(rounded-2xl bg-primary-50 border-primary-100 p-6) ─┐
│ AI からの問い  (text-xs text-primary-700)                          │
│                                                                    │
│ 「一言が、まだ                       (text-lg italic-寄り)         │
│ 引っかかってる」                                                   │
│ って、その引っかかりは                                             │
│ どこからきてる?                                                   │
└────────────────────────────────────────────────────────────────────┘

[Textarea(rows=4、Q2 と同じ style)]
[「つぎへ」(Primary button、bg-primary-500)]
```

Highlighted card(`bg-primary-50` / `border-primary-100`)で AI 出力の「特別さ」を視覚化、ただし派手にしすぎない。

**Skip option:** v1.0 では出さない(silent skip 自動のみ、user 操作可能化は v1.1)。

---

## 4. Architecture

### 4.1 `lib/ai/` 抽象化基盤

```
lib/ai/
├── index.ts                  # high-level API: chat({ system, user, fewShots?, options? })
├── types.ts                  # Message, ChatRequest, ChatResponse, ChatError types
├── providers/
│   ├── gemini.ts             # Gemini 2.0 Flash 実装(@google/genai SDK)
│   └── anthropic.ts          # future v1.1+ stub、throw NotImplementedError
└── prompts/
    └── follow-up.ts          # system prompt + user message builder + few-shot examples
```

`index.ts` が provider 切替の唯一の場所:
```typescript
import { gemini } from "./providers/gemini";
import { anthropic } from "./providers/anthropic";

const PROVIDER = process.env.AI_PROVIDER ?? "gemini";

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  switch (PROVIDER) {
    case "gemini": return gemini.chat(req);
    case "anthropic": return anthropic.chat(req);
    default: throw new Error(`Unknown AI provider: ${PROVIDER}`);
  }
}
```

v1.1+ で Anthropic に切替えるときは env var 1 つ + provider 実装の差し替えで完結。

### 4.2 Server Action 層

```
lib/server-actions/
├── ai-followup.ts            # generateFollowUpQuestion() ─ AI follow-up 専用
└── entries.ts                # submitEntry を拡張、aiQuestion / aiAnswer optional に
```

`ai-followup.ts` signature:
```typescript
export interface FollowUpInput {
  bodyPhase: 1 | 2 | 3 | 4 | 5;
  bodySensationLabel: string;  // "重たい" 等、template から
  freeText: string;            // Q2 内容
}

export interface FollowUpResult {
  question: string;            // 成功時、AI 生成質問
}

export interface FollowUpError {
  error: "timeout" | "api_error" | "rate_limit" | "empty_response";
}

export async function generateFollowUpQuestion(
  input: FollowUpInput,
): Promise<FollowUpResult | FollowUpError>;
```

retry / timeout / error mapping は server action 内で吸収。client は success / fail だけ受け取る。

### 4.3 UI Component 層

```
app/today/_components/
├── QuestionFlow.tsx          # 改修:Q2 と Q3 の間に AI step 挿入、state machine 拡張
└── AIQuestionStep.tsx        # 新規:loading / question display / input / fallback display
```

`QuestionFlow.tsx` の state は現状 `step: number`(0,1,2 = Q1/Q2/Q3)。これに AI step を追加(step 1.5 概念だが整数で扱うため `aiStep: "pending" | "loading" | "answered" | "skipped"` を別 state 化)。

`AIQuestionStep.tsx` props:
```typescript
interface Props {
  bodyPhase: 1 | 2 | 3 | 4 | 5;
  bodySensationLabel: string;
  q2Text: string;
  onComplete: (aiQuestion: string | null, aiAnswer: string | null) => void;
  // aiQuestion null = silent skip 発火、aiAnswer null = skip パス
}
```

### 4.4 既存 component への影響

- `components/BloomMoon.tsx`:変更なし
- `components/CallbackCard.tsx`:変更なし
- `components/MoonPhase.tsx`:変更なし
- `lib/server-actions/callback.ts`:変更なし
- `lib/utils/streak.ts`:変更なし
- `app/today/page.tsx`:変更なし(QuestionFlow を render する entry point)
- `app/calendar/[date]/page.tsx`:変更なし(QuestionFlow を render する entry point、過去日にも AI 質問 step が乗る ─ 過去日は AI 質問なしの選択肢も検討、ただし scope 外。v1.0 launch 後 friction 観察で判断)

---

## 5. Data Flow

```
1. user が Q1 / Q2 入力 → Q2 submit
   ↓
2. QuestionFlow:setStep に進めず、AIQuestionStep を render
   ↓
3. AIQuestionStep:useEffect で generateFollowUpQuestion() 呼ぶ、loading 表示
   ↓
4. ai-followup.ts(server):
   - lib/ai/prompts/follow-up.ts から system + user message + few-shots を build
   - lib/ai/chat() に渡す(retry/timeout はここで管理)
   - 成功:{ question } 返す
   - 失敗:{ error } 返す
   ↓
5. AIQuestionStep:
   - 成功:question を card 表示、textarea 表示
   - 失敗:onComplete(null, null) で skip 通知
   ↓
6. user が AI 質問に answer 入力 → submit
   ↓
7. AIQuestionStep:onComplete(aiQuestion, aiAnswer) で QuestionFlow に渡す
   ↓
8. QuestionFlow:aiQuestion + aiAnswer を state に保存、Q3 step に進む
   ↓
9. Q3 submit
   ↓
10. QuestionFlow:全部まとめて submitEntry({ ..., aiQuestion, aiAnswer })
   ↓
11. submitEntry:
    - 既存通り entry upsert + answers 削除
    - answers insert 4 行(pos 1=Q1、pos 2=Q2、pos 4=AI、pos 3=Q3)
    - pos 4 行は question_text=AI 質問、value_text=user 回答
    - aiQuestion=null の場合(skip)、pos 4 行は insert しない
   ↓
12. 既存 redirect 分岐(/today/done or /calendar/[date])
```

DB schema は Phase 0 callback migration で既に対応済み(`question_text` col + pos 4 CHECK)、追加 migration なし。

---

## 6. Prompt Template

`lib/ai/prompts/follow-up.ts`:

```typescript
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

export function buildUserMessage(input: {
  bodySensationLabel: string;
  freeText: string;
}): string {
  return `Q1(体感):${input.bodySensationLabel}
Q2(今日のこと):${input.freeText}

→ Q2 から1フレーズを引用して、問い返す1問を出力。`;
}

export const FOLLOW_UP_FEW_SHOTS = [
  {
    user: `Q1(体感):重たい
Q2(今日のこと):会議で〇〇さんに言われた一言が、まだ引っかかってる。

→ Q2 から1フレーズを引用して、問い返す1問を出力。`,
    assistant: `「一言が、まだ引っかかってる」って、その引っかかりはどこからきてる?`,
  },
  {
    user: `Q1(体感):ふつう
Q2(今日のこと):夕方の散歩で、空がやけに静かだった。

→ Q2 から1フレーズを引用して、問い返す1問を出力。`,
    assistant: `「やけに静か」だった空、いま思い出してどんな?`,
  },
  {
    user: `Q1(体感):軽やか
Q2(今日のこと):締切に追われて、ごはんが砂を噛むようだった。

→ Q2 から1フレーズを引用して、問い返す1問を出力。`,
    assistant: `「砂を噛むよう」って、もう少し聞かせて?`,
  },
];
```

呼び出し時の Gemini 設定:
- `model: "gemini-2.0-flash"`
- `temperature: 0.4`(出力安定化、創発性は抑える)
- `maxOutputTokens: 100`(質問1問なので十分)
- `topP: 0.9`

---

## 7. Error Handling

| ケース | 検出 | 挙動 |
|---|---|---|
| API 接続エラー | `fetch` reject / network error | retry 1回 → 失敗なら silent skip |
| timeout(8秒) | `AbortController` で打ち切り | retry 1回 → 失敗なら silent skip |
| HTTP 4xx / 5xx | response.ok === false | retry 1回 → 失敗なら silent skip |
| rate limit(429)| HTTP 429 | retry なし、即 silent skip(retry しても 429) |
| 空 response | response.text === "" | silent skip(retry なし、prompt の問題なので retry でも変わらない) |
| 引用なし出力(prompt 違反)| client 側 validation で "「" 含まないと判定 | **v1.0:そのまま使う**(過剰検証しない、Phase 0 観察で frequency 高ければ v1.1 で validation + retry 追加) |
| Q2 が空(submit validation で防いでるが念のため) | server で `freeText.trim() === ""` | AI 呼ばず Q3 へ直行(skip 状態) |

soft silent(skip 時の UI 表記):Q3 prompt 上に `text-xs text-neutral-500` で「今夜は静かに進みます」1行。

---

## 8. Implementation Scope

### In scope(本 spec)

- `lib/ai/` 抽象化(index.ts / types.ts / providers/gemini.ts / providers/anthropic.ts stub / prompts/follow-up.ts)
- `lib/server-actions/ai-followup.ts`(generateFollowUpQuestion + retry / timeout logic)
- `lib/server-actions/entries.ts` 拡張(submitEntry に optional aiQuestion / aiAnswer 追加、pos 4 で answers insert)
- `app/today/_components/QuestionFlow.tsx` 改修(AI step 挿入、state 拡張)
- 新規 `app/today/_components/AIQuestionStep.tsx`
- `.env.example` に `GEMINI_API_KEY` + `AI_PROVIDER`(オプション、default=gemini)追記
- `package.json` に `@google/genai` 依存追加
- `docs/SPEC.md` AI セクション update(現状 Claude 言及を Gemini に書き換え、フロー詳細を本 spec 準拠に)

### Out of scope(future)

- **streaming response**(token-by-token rendering、v1.1 検討。まず await で着地)
- **multi-turn 対話**(ADR-012 通り single でスタート、v2.0+)
- **Free / Pro gating**(Phase 1 owner 単独、Stripe / Pro 課金は v1.1)
- **skip button**(silent skip 自動のみ、user 操作可能化は v1.1)
- **AI 出力 validation + retry**(引用なし出力の自動 reject、Phase 0 観察次第)
- **月次レポート**(別 sub-project C、本 spec の `lib/ai/` を再利用)
- **Anthropic provider 実装**(stub のみ、v1.1+)
- **AI 質問の編集 / 再生成**(user が「他の質問を出して」と頼める)
- **過去 entry へ AI 質問 retroactive 生成**(Phase 0 データには AI 質問なし、それでよい)
- **/calendar/[date] 経由の過去 entry submit で AI 質問を出すか否か**(現状の素直な実装では出る、過去日にも AI 質問が乗る挙動 ─ launch 後 friction 観察で決定)
- **AI 質問の i18n / 多言語化**(現状 JP only、v2.0+)

---

## 9. Testing

CLAUDE.md「v0 はテストなし、v1.0 launch 前に Playwright 導入」方針に従い、**自動テストなし**。

手動 smoke + 観察:
- [ ] Q2 submit → AI 質問が 1-3 秒以内に表示
- [ ] AI 質問に「...」引用が含まれる(ADR-016 遵守目視)
- [ ] AI 質問が 1〜2 文に収まる(prompt 守ってる)
- [ ] AI 質問に対する user 回答 → Q3 へ自然に遷移
- [ ] /today/done で entry 全体が saved(answers 4 行、pos 4 含む)
- [ ] /calendar/[date] で saved entry を見ると pos 4 の AI 質問 + 回答が表示される ─ **要 confirm**:`/calendar/[date]` page detail mode で pos 4 をどう表示するか、本 spec out of scope なので別 sub-task で UI 追加検討
- [ ] timeout(network throttle で simulate)→ retry → silent skip → 「今夜は静かに進みます」表示 → Q3 通過
- [ ] Gemini API key 未設定 → 起動時 or 初回 call で error、silent skip 動作確認

Phase 0 中の質的観察:
- [ ] AI 質問が「ADR-016 違反」(要約・診断・アドバイス含む)になっていないか
- [ ] 質問が「いつも同じパターン」に陥っていないか、prompt の variety
- [ ] silent skip が頻発しないか(API stability / rate limit)
- [ ] loading 時の「ひと呼吸…」が体感「待たされる感」より「儀式的 pause」になっているか

---

## 10. Privacy

- Gemini API は Q1 体感 label + Q2 自由記述を Google サーバーに送信
- Google [Gemini API privacy](https://ai.google.dev/gemini-api/terms):**free tier は training に使われる可能性あり**、Pro tier(paid)で opt-out 可能
- v1.0 は **free tier 採用**(コスト優先、ADR-021)= user 入力が Google モデル training に使われる可能性 **あり**
- これを **`/privacy` page で明示**(v1.0 launch 前必須、sub-project G の scope)
- 本 spec では「privacy policy 更新必要」を flag するのみ、page 実装は別

オーナー Phase 1 セルフテスト中の data 取り扱い:
- Phase 1 は owner のみ、own data の Google 送信を許容するかは owner 判断
- 何らかの理由で Gemini を使いたくない場合、`.env.local` から `GEMINI_API_KEY` を抜けば silent skip パスを毎回踏む(機能は無効化、エラーは出ない)

---

## 11. Open Questions(設計時点、実装中に解消)

- **Loading「ひと呼吸…」のコピー文言**:bett er な常体表現あるか?「いま聞かれてる」「ちょっとだけ間」等、実装時に1-2案出して目視で選定
- **AI question card の visual hierarchy**:Q2 textarea と同じ style か、italic で differentiate するか、実装時に Pencil mockup で確認
- **`/calendar/[date]` detail mode での AI 質問 + 回答表示**:pos 4 を表示するか否か、表示するなら EntryDetail に Section 追加(本 spec scope 外、別 issue で track 推奨)
- **Gemini SDK のバージョン pin**:`@google/genai` の semver、Phase 1 着手時に latest stable を pin(SDK は活発に更新中、breaking changes 観察必要)
- **過去日 entry に AI 質問を生成するか**:`/calendar/[date]?edit=1` 経由の submit で AI step を踏むか否か、launch 後 friction 観察で決める

---

## 12. References

- ブレスト履歴:本セッション 2026-05-18
- ADR-012:AI follow-up question(設計の起点)
- ADR-016:AI は引用係(prompt 設計の核)
- ADR-019:worldview(loading / skip / error の framing)
- ADR-021:Gemini 2.0 Flash 採用(LLM provider)
- 既存 component:`components/MoonPhase.tsx`、`components/CallbackCard.tsx`、`app/today/_components/QuestionFlow.tsx`、`MoodInput.tsx`、`FreeTextInput.tsx`、`ProgressDots.tsx`
- 既存 schema:`supabase/migrations/20260517000000_callback_state.sql`(`question_text` col + pos 4 CHECK は本 spec 用に forward-compat 済み)
- NEXT-ACTIONS:🌓 v1.0「コア機能(必須)」AI follow-up question 実装(着手 = in-progress マーク)
