# 月次レポートの schema 再設計(ADR-016 準拠 curation primitive)─ Design

> Status: **実装完了**(2026-05-23)
> 日付: 2026-05-23
> 関連 ADR: ADR-016(AI は引用係、解釈者ではない)/ ADR-019(worldview)/ ADR-021・022(AI provider)/ ADR-024(構造化出力パス)
> 関連 spec: `docs/SPEC.md` §9(現行ドラフトを本 spec が丸ごと置換)
> ブレスト履歴: 本セッション 2026-05-23

---

## 1. Overview

`monthly_reports` テーブルと月次レポート生成プロンプトを ADR-016「引用係原則」に準拠する形へ全面再設計する。物語的要約・解釈ラベルを廃し、出力を**5つの curation primitive**(数値統計・頻出語・印象的だった日・重みのある一言・対比のペア)に限定する。

スコープは **生成 + schema + プロンプト + 検証** まで。閲覧 UI(`/reports/[year]/[month]` ページ等)は別 spec で扱う(NEXT-ACTIONS §「月次レポート閲覧ページ」)。

---

## 2. 背景:現行ドラフトの ADR-016 違反

`docs/SPEC.md` §9 の現プロンプトと `monthly_reports` 列定義に違反箇所が3つある:

| # | 場所 | 違反内容 | ADR-016 上の位置 |
|---|---|---|---|
| 1 | `summary_text TEXT NOT NULL` | 「今月のあなたを2-3段落で…」物語的要約 | 「要約するな」 |
| 2 | `numerical_trends.trend: "up"\|"stable"\|"down"` | 月のラベル(上向き / 下降) | 「カテゴリラベルを付けるな」 |
| 3 | `patterns: [{type, insight}]` | `insight` 自由文で AI がパターンに言葉を当てる | 「パターンを名付けるな」 |

セーフ:`word_frequencies`(生 frequency)と `highlight_entry_ids`(参照のみ)。本設計はこれらを維持し、違反箇所を全消し+足りないプリミティブを追加する。

ADR-016 の核(再確認):**AI は選ぶ・配置する。ユーザーが解釈する**。AI が新しい文章を出力する余地を**スキーマレベルでゼロ**にする。

---

## 3. 設計の核:5つのプリミティブ

| # | プリミティブ | 由来 | 役割 |
|---|---|---|---|
| 1 | 数値統計 | **deterministic** | 月の生データ:エントリ数、身体感覚の分布 |
| 2 | 頻出語 | **deterministic** | ストップワード除外で上位10〜15語、出現回数のみ |
| 3 | 印象的だった日 | **AI 選択** | 3〜5 日の entry_id のみ。理由は書かない |
| 4 | 重みのある一言 | **AI 選択** | 5〜8件、verbatim 引用文字列 + 出典 entry_id |
| 5 | 対比のペア | **AI 選択** | 1〜2組、entry_id ペアのみ。対比のタイプは書かない |

**1〜2 は AI を呼ばない**(計算で出る・コストゼロ・ハルシネーション不可)。**3〜5 は AI に「選ばせる」**が、出力は entry_id 参照と verbatim 文字列のみ ── 自由文の `description` / `insight` / `theme` / `label` / `summary` フィールドを**スキーマレベルで一切持たせない**。「AI は curate / juxtapose してよいが、name するな」(ADR-016)を物理ガードレールに変換する。

---

## 4. DB schema 変更

### 4.1 新スキーマ

```sql
monthly_reports (
  id uuid PK,
  user_id uuid → auth.users.id ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- 1. 数値統計(deterministic)
  entry_count integer NOT NULL,
  body_phase_distribution jsonb NOT NULL,
    -- {"1": 3, "2": 5, "3": 10, "4": 7, "5": 5}

  -- 2. 頻出語(deterministic、上位10〜15語、ストップワード除外)
  word_frequencies jsonb NOT NULL,
    -- [{"word": "集中", "count": 12}, {"word": "疲れた", "count": 8}, ...]
    -- 配列にして count 降順を保持(JSON object だと順序が保証されないため)

  -- 3. 印象的だった日(AI 選択、entry_id のみ)
  highlight_entry_ids uuid[] NOT NULL DEFAULT '{}',

  -- 4. 重みのある一言(AI 選択、verbatim 引用)
  top_phrases jsonb NOT NULL DEFAULT '[]',
    -- [{"entry_id": "uuid", "phrase": "verbatim 部分文字列"}, ...]

  -- 5. 対比のペア(AI 選択、entry_id ペアのみ)
  day_pairs jsonb NOT NULL DEFAULT '[]',
    -- [["entry_id_a", "entry_id_b"], ...]

  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
)
```

### 4.2 廃止する列

- `summary_text` ── 違反 #1
- `numerical_trends` ── 違反 #2(数値部分は `entry_count` + `body_phase_distribution` へ分解、`trend` ラベルは廃止)
- `patterns` ── 違反 #3(curation を表現したいなら `day_pairs` で代替)

### 4.3 Migration

`monthly_reports` テーブルは初期 migration(`20260510000000_initial.sql`)で作成済み、行は 0(v1.1 未着手)。destructive ALTER で OK。

```sql
-- supabase/migrations/2026XXXXXXXXXX_monthly_report_redesign.sql
alter table monthly_reports
  drop column summary_text,
  drop column numerical_trends,
  drop column patterns;

alter table monthly_reports
  add column entry_count integer not null default 0,
  add column body_phase_distribution jsonb not null default '{}',
  add column top_phrases jsonb not null default '[]',
  add column day_pairs jsonb not null default '[]';

-- word_frequencies は JSON object → JSON array に shape を変える(本 migration 時点で行 0 なので破壊的変更は無害)
-- highlight_entry_ids は維持(NOT NULL + DEFAULT '{}' は既存定義による)
```

注:`word_frequencies` 列は存在維持・JSON shape のみ変わる(オブジェクト → 配列)。行が無いので column-level の alter は不要。

### 4.4 Index・RLS

- 既存 `idx_reports_user_year_month` を維持
- RLS は既存ポリシー(本人のみ select)で十分。生成 server action は service role で書き込む(Vercel Cron 経由)

---

## 5. AI プロンプト(`lib/ai/prompts/monthly-report.ts` 新設)

### 5.1 System prompt(草案)

```
あなたは寝る前ジャーナルの1ヶ月分を読み、選び、並べる役割。
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
前置き・説明・コードフェンスを付けない。
```

### 5.2 User message(入力)

前月の全エントリを以下の JSON 配列で渡す:

```json
[
  {
    "entry_id": "uuid",
    "date": "2026-04-15",
    "body_phase": 2,
    "body_label": "ざわざわ",
    "q2": "会議で〇〇さんに...",
    "q3": "明日もがんばる",
    "ai_dialog": [
      {"q": "「一言が、まだ引っかかってる」って、その引っかかりはどこからきてる?", "a": "..."},
      ...
    ]
  },
  ...
]
```

AI 対話は context 量と引用候補を増やすため含める(top_phrases は Q2 だけでなく AI 対話の user 回答からも引いてよい)。

### 5.3 `lib/ai/` での呼び出し

`lib/ai/chat()` を ADR-024 で導入した `responseSchema` 構造化出力で呼ぶ。出力スキーマ:

```typescript
const MONTHLY_REPORT_RESPONSE_SCHEMA = {
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
```

---

## 6. モデル選択

**Anthropic Claude Sonnet 4.6**(`claude-sonnet-4-6`)を採用。

- 月次は **ユーザーあたり月1回**、入力 ≈ 3000 tokens / 出力 ≈ 1500 tokens。Sonnet でも 1レポートあたり数〜十数円程度、`¥480/月` の Pro 売上に対し negligible
- 選択タスク(top phrases / day pairs)は AI の「センス」が品質に直結する curation 軸 ── ここに Sonnet を投資する価値あり
- 日次の Haiku 4.5 と provider 層は共有、`model` パラメータで切替

### 6.1 必要なインフラ前提(本 spec で同時対応)

現状 `lib/ai/types.ts` の `ChatRequest` に `model?: string` フィールドが無い(Gemini provider は MODEL 定数固定)。本 spec のスコープに以下を含める:

- `ChatRequest` に `model?: string` を追加(provider 既定値を上書き可能)
- `lib/ai/providers/anthropic.ts` の **stub を実装**して Anthropic SDK 経由で chat 呼び出しを動作させる(現在 stub のまま、ADR-022 の決定がコードに反映されていない既知 drift)
- monthly-report 呼び出し時は `provider: "anthropic"` + `model: "claude-sonnet-4-6"` を明示

(daily AI follow-up が Gemini で動いている現状の挙動は変えない。env で provider 切替は別件。)

---

## 7. 生成フロー

### 7.1 Vercel Cron + API Route

```
0 0 1 * * → /api/cron/monthly-reports
```

毎月1日 00:00 UTC(09:00 JST)。`CRON_SECRET` で authorize(`DEPLOYMENT.md` 既出)。

### 7.2 処理(API Route 内、`generateMonthlyReportForUser(userId, year, month)` server action 呼び出し)

```
1. 前月の (year, month) を計算
2. 全ユーザーをループ:
   2.1 当該ユーザーの前月エントリを取得(answers join 込み、pos 1-6 全部)
   2.2 entries.length < 5 → スキップ(信号不足)
   2.3 deterministic:
       - entry_count = entries.length
       - body_phase_distribution = entries.map(e => e.pos1_value_number) で集計
       - word_frequencies = entries の Q2 + Q3 free_text + AI 対話 answer を tokenize、
         ストップワード除外、上位 15 語(降順)
   2.4 AI prompt 構築 → lib/ai/chat() を Sonnet 4.6 + responseSchema で呼ぶ
   2.5 レスポンス parse → 検証(§8) → 違反プリミティブを drop
   2.6 monthly_reports に upsert(idempotent、(user_id, year, month) で overwrite)
```

### 7.3 冪等性

`UNIQUE (user_id, year, month)` の制約下で **upsert(overwrite)**。同じ月に対して再生成すれば後勝ち。バグ修正後の手動再実行や Cron リトライが安全。

---

## 8. 検証(critical for ADR-016 enforcement)

server 側で AI レスポンスに対し2層チェック:

### 8.1 Verbatim 厳守チェック(top_phrases)

各 `{entry_id, phrase}` について:

1. `entry_id` がそのユーザー × 対象月のエントリ集合に含まれるか
2. `phrase` が**当該エントリの本文(Q2 / Q3 free_text / AI 対話の user answer のいずれか)の部分文字列か**

両方 OK のみ採用。違反は当該エントリのみ drop(top_phrases 全体は救う)。

### 8.2 ID 所有者チェック(highlight_entry_ids / day_pairs)

各 entry_id がそのユーザー × 対象月のものか。違反は当該エントリ / ペアを drop。

### 8.3 重複・件数のクランプ

- `top_phrases` 5〜8 件:多すぎなら head 8 で切る、少なすぎは許容(空でも報告は成立)
- `highlight_entry_ids` 3〜5 件:同上(head 5)
- `day_pairs` 1〜2 組:同上(head 2)、ペアの2要素が同じ entry_id なら drop

検証完了後の状態を `monthly_reports` に upsert する。

---

## 9. エラーハンドリング

| ケース | 挙動 |
|---|---|
| AI 呼び出し timeout / 5xx | retry 1 回、失敗継続なら**そのユーザーは skip**(deterministic 部分も書き込まない、翌月再試行) |
| AI が空応答 / JSON parse 失敗 | 同上(skip) |
| AI が部分的に違反(top_phrases が空 等) | 検証通過分のみ保存、報告は成立 |
| entries < 5 | 生成スキップ(monthly_reports に行を作らない) |
| すべてのユーザーで AI 連続失敗 | rate limit 等の可能性 ── Cron は exit 0 で終了、Sentry / 通知は v1.1+ 別件 |

---

## 10. Implementation Scope

### In scope(本 spec)

- migration `2026XXXXXXXXXX_monthly_report_redesign.sql`(列 add/drop)
- `lib/ai/types.ts` に `ChatRequest.model?: string` 追加
- `lib/ai/providers/anthropic.ts` stub の実装(`@anthropic-ai/sdk` で chat 呼び出し、responseSchema 対応)
- `lib/ai/prompts/monthly-report.ts` 新設(system prompt + few-shot + buildMessages + responseSchema)
- `lib/server-actions/monthly-report.ts` 新設(deterministic 計算 + AI 呼び出し + 検証 + upsert)
- `app/api/cron/monthly-reports/route.ts` 新設(`CRON_SECRET` 認証 + 全ユーザーループ)
- `vercel.json` または Vercel Dashboard で Cron schedule を `0 0 1 * *` に設定
- `lib/types.ts` に `MonthlyReport` interface(新 schema 準拠)
- `docs/SPEC.md` §9 を本 spec 準拠に書き換え

### Out of scope(別 spec)

- **閲覧 UI**(`/reports/[year]/[month]` ページ等) ── NEXT-ACTIONS の独立項目
- **プッシュ通知**(月次レポート生成完了通知) ── Web Push 自体が v1.1+
- **手動再生成 UI**(設定からの「先月を再生成」ボタン) ── v1.1+ で必要なら別件
- **few-shot 例**(AI 対話と異なり、月次は1ユーザーの実データが揃ってから具体例を作るほうが質が高い。v1.1 launch 前にオーナーの Phase 0+α 実データで作成)
- **AI provider の env 設定改修**(日次を Gemini → Anthropic に切り替える別件)

### 自動テストなし(CLAUDE.md 方針)

検証は `npm run typecheck` + `npm run build`、運用検証は Phase 0+α 実データでの初回月次生成を手動 trigger(`vercel cron trigger` 相当)で実施。

---

## 11. ADR の要否

新規 ADR は**起こさない**。本設計は ADR-016(引用係原則)を月次レポートに適用する**実装**であり、新規の意思決定を含まない。先行 ADR の影響セクションに具体的実装が反映される形。

(ADR-022 で日次の provider を Anthropic に切り替えた決定はあるが、コードに反映されていない drift があった ── §6.1 でその drift を本 spec 内で解消する。)

---

## 12. Testing

CLAUDE.md「v0 はテストなし」方針どおり自動テストなし。手動 smoke:

- [ ] migration を Supabase に適用 → `monthly_reports` の列が新スキーマで構築
- [ ] Anthropic provider の chat 呼び出しが Sonnet 4.6 で動作(`lib/ai/providers/anthropic.ts` を単発呼び出しで確認)
- [ ] `/api/cron/monthly-reports` を手動 trigger(`CRON_SECRET` 付き curl)→ Phase 0+α 実データに対してレポート生成
- [ ] 生成された `monthly_reports` 行の検証:
  - [ ] `top_phrases[].phrase` がそれぞれ source entry の本文に含まれている(verbatim)
  - [ ] `highlight_entry_ids` がすべて当該ユーザー × 対象月
  - [ ] `day_pairs` が同上
  - [ ] `entry_count` / `body_phase_distribution` / `word_frequencies` が deterministic に正しい
- [ ] entries < 5 のユーザーで skip される
- [ ] 同じ (user_id, year, month) で再実行 → overwrite される

質的観察(Phase 0+α データ):
- [ ] AI 選択(top_phrases / highlight / day_pairs)が「ADR-016 違反になっていない」(ラベル・解釈が混入していない)
- [ ] 選ばれた phrases が verbatim 厳守(編集されていない)
- [ ] highlight day と day_pair の重複(同じ entry_id が highlight にも day_pair にも入る)が許容範囲か
- [ ] Sonnet 4.6 の出力品質と cost が見積もり範囲内か

---

## 13. Open Questions

- **few-shot のタイミング**:本 spec 着手時点では few-shot を入れない(zero-shot)。Phase 0+α の実データで初回生成 → 質に問題があれば few-shot を後付け。実際の生成例から学習させたほうが具体的
- **word_frequencies のストップワード**:日本語ストップワードリストは TinySegmenter 同梱 or 自作。実装時に決める(`docs/COPY.md` 等にあとで集約も可)
- **AI 対話の引用扱い**:`top_phrases` の引用元に AI follow-up の user answer も含めるか(本案では含める)、Q2/Q3 のみに絞るか。Phase 0+α 観察で判断
- **highlight と day_pair の重複ポリシー**:同じ日が highlight と day_pair の両方に出るのを許すか禁じるか。今は許す(別軸の curation として独立)。Phase 0+α 観察で違和感があれば調整

---

## 14. References

- ブレスト履歴:本セッション 2026-05-23
- ADR-016:AI は引用係、解釈者ではない(本 spec の核)
- ADR-019:worldview(レポートが「夜空を見上げる」体験になるための制約)
- ADR-022:AI provider を Anthropic Haiku 4.5 に切替(本 spec で provider 層を Sonnet 含め本実装)
- ADR-024:`responseSchema` 構造化出力パスを `lib/ai/` に追加済み(本 spec が再利用)
- `docs/SPEC.md` §9(本 spec が丸ごと置換)
- 既存 schema:`supabase/migrations/20260510000000_initial.sql`(`monthly_reports` 初期定義)
- ROADMAP v1.0:月次 AI レポートを Sonnet 4.6 + Vercel Cron で実装と明記
