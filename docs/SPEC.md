# 技術仕様: ほしふみ

> 実装仕様書
> 最終更新: 2026-05-16
> 改名履歴:みっつ → いとなみ(2026-05-14, ADR-015) → ほしふみ(2026-05-16, ADR-018)
>
> ⚠️ 2026-05-16 時点で、実装は ADR-013/014(Q1 身体感覚、Q3 自由記述 closure)を反映しているが、**AI follow-up ステップ(ADR-012)と past-entry callback(ADR-017)は未実装**。以下のセクションで日次フローを記述する箇所は AI 統合後の目標設計を前提にしている部分があるので注意。

## 1. システムアーキテクチャ

```
┌─────────────────┐         ┌──────────────────┐
│  Next.js (Vercel) │ ◄────► │ Supabase         │
│  - SSR pages     │         │ - Postgres (RLS) │
│  - Server Actions│         │ - Auth (Magic L) │
│  - Edge Middlewar│         │ - Storage        │
└────────┬────────┘         └──────────────────┘
         │
         ▼
┌─────────────────┐
│ Anthropic API   │
│ Claude Sonnet 4.6│
│ Claude Haiku 4.5 │
└─────────────────┘
```

### リクエストフロー(日次入力 ─ ADR-012 適用後の目標)
1. ユーザーが `/today` を開く → SSR が今日の既存エントリを取得(あれば)
2. ユーザーが固定 Q1(身体感覚タップ)+ Q2(自由記述)を完了 → 送信で AI follow-up 生成がトリガー
3. Claude が Q1+Q2 を読み、個別化された「why」質問を1つ生成 → クライアントに返って次ステップとして描画
4. ユーザーが AI 質問に答える(自由記述) → 固定 Q3(明日への自由記述 closure)へ
5. 最終送信で、Server Action `submitEntry` が `entries` を upsert、`answers` を置き換え(4行:Q1 体・Q2 出来事・AI 生成・Q3 closure)、AI 質問テキストを保存、`updateStreakForUser` を呼ぶ
6. Action が `/today` と `/calendar` パスを revalidate
7. クライアントが `/today/done` に遷移

> 注:現在のコードは step 1-2 と 5-7 を v0 形状の `answers` テーブル(3行)で実装している。Step 3-4(AI ステップ)は 2026-05-16 時点で未実装。

### リクエストフロー(月次 AI レポート - v1.1)
1. Vercel Cron が毎月1日 09:00 JST に起動
2. Cron エンドポイントが前月に5件以上エントリのある Pro+ ユーザーを iterate
3. 各ユーザー:エントリ取得 → プロンプト構築 → Claude Sonnet 4.6 呼び出し → `monthly_reports` に格納
4. プッシュ通知(v1.1+)

## 2. データベーススキーマ

### テーブル(v0 / Day 1)

```sql
-- profiles: User profile (1-to-1 with auth.users)
profiles (
  id              uuid PK → auth.users.id
  email           text NOT NULL
  display_name    text
  notification_time time DEFAULT '22:00:00'
  notification_enabled boolean DEFAULT true
  timezone        text DEFAULT 'Asia/Tokyo'
  plan            text CHECK IN ('free','pro','premium') DEFAULT 'free'
  streak_days     integer DEFAULT 0
  longest_streak  integer DEFAULT 0
  last_entry_at   timestamptz
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)

-- entries: One per user per day
entries (
  id              uuid PK
  user_id         uuid → auth.users.id
  entry_date      date NOT NULL          -- JST calendar date
  template_name   text NOT NULL DEFAULT 'basic'
  completed_at    timestamptz
  created_at      timestamptz
  updated_at      timestamptz
  UNIQUE (user_id, entry_date)
)

-- answers: Three rows per entry (position 1-3)
answers (
  id                uuid PK
  entry_id          uuid → entries.id ON DELETE CASCADE
  question_position integer CHECK BETWEEN 1 AND 3
  value_number      integer    -- for mood_5, scale_5, rating_4
  value_text        text       -- for free_text, voice_text
  value_choice      text       -- for short_choice
  created_at        timestamptz
  UNIQUE (entry_id, question_position)
)
```

### テーブル(v1.1+)

```sql
-- monthly_reports: AI-generated monthly summary
monthly_reports (
  id                uuid PK
  user_id           uuid → auth.users.id
  year              integer
  month             integer CHECK BETWEEN 1 AND 12
  summary_text      text NOT NULL
  numerical_trends  jsonb        -- {mood_avg: 3.4, completion_rate: 0.78}
  word_frequencies  jsonb        -- {"集中": 12, "疲れた": 8}
  highlight_entry_ids uuid[]
  patterns          jsonb        -- AI-detected patterns
  generated_at      timestamptz
  UNIQUE (user_id, year, month)
)

-- custom_templates (v1.1+): User-defined templates
custom_templates (
  id              uuid PK
  user_id         uuid → auth.users.id
  name            text
  emoji           text
  questions       jsonb NOT NULL  -- array of {position, text, input_type, options}
  is_active       boolean
  created_at      timestamptz
)
```

### RLS ポリシー

全テーブル共通パターン:
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`(WITH CHECK 経由)
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

子テーブル(answers)は親(entries)に対する subquery で RLS。

### インデックス

```sql
CREATE INDEX idx_entries_user_date ON entries(user_id, entry_date DESC);
CREATE INDEX idx_answers_entry ON answers(entry_id);
CREATE INDEX idx_reports_user_year_month ON monthly_reports(user_id, year DESC, month DESC);
```

### トリガー

```sql
-- Auto-create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 3. テンプレート仕様

### v0/current:Basic テンプレート(ADR-013/014 適用後、ADR-012 適用前)

```typescript
{
  name: "basic",
  emoji: "🌒",
  description: "体・できごと・明日へ",
  questions: [
    {
      position: 1,
      text: "いまの体の感じは?",
      input_type: "mood_5",  // widget は再利用、semantics は身体感覚に変更 (ADR-013)
      options: [
        { value: 1, emoji: "🌑", label: "重たい" },
        { value: 2, emoji: "🌒", label: "ざわざわ" },
        { value: 3, emoji: "🌓", label: "ふつう" },
        { value: 4, emoji: "🌔", label: "軽い" },
        { value: 5, emoji: "🌕", label: "軽やか" }
      ]
    },
    {
      position: 2,
      text: "今日いちばん印象に残ったこと",
      input_type: "free_text",
      placeholder: "ひとことでも、ふたことでも"
    },
    {
      position: 3,
      text: "明日の自分にひとことだけ",
      input_type: "free_text",  // v0 では short_choice、ADR-014 で変更
      placeholder: "短く、ひと言で"
    }
  ]
}
```

注:`emoji` フィールドは月相 unicode を fallback としてデータに残しているが、UI 描画は `<MoonPhase phase={value}>` コンポーネントで brand-consistent な SVG を表示する。

### v1.0 目標:Q2 と Q3 の間に AI follow-up を挿入(ADR-012)

Position 3 が AI 生成質問になり(テキストは answer row に格納)、固定 closure は position 4 にシフト。`question_position` の CHECK 制約を緩和する必要あり。詳細なスキーマ migration 設計は 2026-05-16 時点で TBD。

### v1.0 目標:追加テンプレート

Basic 以外のテンプレートを v1.0 で追加。同じ構造(固定 Q1 タップ + 固定 Q2 自由記述 + AI follow-up + 固定 Q3 closure)で、文言と scaffolding の角度(仕事、子育て、クリエイター等)が異なる。具体的なテンプレートセットは Phase 0 セルフテスト後に決定。

### 普遍ルール
- Position 1(固定):5タップの定量 ─ 身体感覚 or ドメイン固有スケール、分析に使う
- Position 2(固定):定性自由記述 ─ AI に渡す「今日何があったか」の raw 入力
- AI follow-up(動的、v1.0 目標):Position 1+2 から生成される個別化された「why/what」質問1つ
- 最終 position(固定):短い自由記述 closure ─ 寝る前の手放し

## 4. 入力タイプ仕様

| 型 | 格納カラム | UI | メモ |
|---|---|---|---|
| `mood_5` | value_number (1-5) | 5タップ | タップのみ。現在は身体感覚として使用(ADR-013)、widget 名は後方互換で維持。MoonPhase コンポーネントで月相描画 |
| `scale_5` | value_number (1-5) | 5タップ(数字) | タップのみ |
| `rating_4` | value_number (1-4) | ◎○△× ボタン | タップのみ |
| `short_choice` | value_choice (text) | ラップするチップ | 1択。現 Basic テンプレでは未使用(Q3 が free_text に変更、ADR-014)、将来テンプレ用に型 union 維持 |
| `free_text` | value_text | テキストエリア | 複数行可、最大2000文字(client-side enforce) |
| `voice_text` (v1.2+) | value_text (+ voice_audio_url) | マイクボタン → 文字起こし | iOS 標準音声 or Whisper |
| `photo` (v1.2+) | (別 photos テーブル) | カメラ/ライブラリ選択 | 最大 3MB、JPEG/PNG |

## 5. 認証

### Magic Link フロー
1. ユーザーが `/login` でメール入力
2. Server Action が `supabase.auth.signInWithOtp({email, options: {emailRedirectTo: '/auth/callback'}})` を呼ぶ
3. メール受信
4. リンククリック → `/auth/callback?code=...`
5. Callback が `exchangeCodeForSession` でセッション交換
6. `/today` にリダイレクト

### セッション管理
- クッキーベースのセッション、`@supabase/ssr` が管理
- `proxy.ts`(旧 middleware)が全ページリクエストでセッション更新
- セッション期限は Supabase デフォルト(refresh token 1週間)

### メール到達性
- 開発:Supabase 標準 SMTP(rate-limit あり、スパム判定リスク)
- 本番:ローンチ前に Resend / Postmark に移行(Supabase Auth 設定)

## 6. 主要 Server Actions

### `submitEntry(input: SubmitEntryInput)`

入力(現在、AI 統合前):
```typescript
{
  date?: string;          // YYYY-MM-DD, defaults to today JST
  bodySensation: number;  // 1-5 (Q1)
  freeText: string;       // Q2 自由記述
  tomorrowMessage: string; // Q3 自由記述 closure
}
```

挙動:
1. 認証検証
2. `entries` 行を `(user_id, entry_date)` キーで upsert
3. このエントリの既存 `answers` を削除(簡略化:常に置き換え)
4. 新規 `answers` 3行を insert(Q1 → value_number、Q2 → value_text、Q3 → value_text)
5. `updateStreakForUser` で streak 再計算
6. `/today` と `/calendar` パスを revalidate

返り値:`{ success: true, entryId, streak: { streak_days, longest_streak } }`

エラー:未認証または DB エラーで throw。

> v1.0 目標:input に `aiQuestionText: string; aiAnswer: string` を追加、answers の行数が4に増える。Schema migration は ADR-012 で TBD。

### `getEntryByDate(date: string)`

入力:`date`(`YYYY-MM-DD` 形式)
返り値:`EntryWithAnswers | null`

### `getEntriesForMonth(year: number, month: number)`

指定月の現ユーザーの全エントリを返す。

### `sendMagicLink(formData)` と `signOut()`

認証アクション。`lib/server-actions/auth.ts` 参照。

### `selectCallbackEntry()`(v0+、§8 参照)

`/today/done` から呼ばれる Server Action。「向こうから来る」callback として過去エントリを surface するか判定し、出すなら entry + label を返す。

```typescript
async function selectCallbackEntry(): Promise<{
  entry: EntryWithAnswers;
  label: string;   // 例:「数日前のあなた」「ひと月前のあなた」「1年前のあなた」
} | null>
```

このセッションでは callback を出さない場合(cool-down 中、stage 未 unlock、unlocked 範囲に該当エントリなし)は `null` を返す。完全なアルゴリズムは §8 参照。

## 7. Streak 計算

`lib/utils/streak.ts` のロジック:

1. ユーザーの直近365件のエントリ(`completed_at NOT NULL`)を `entry_date` DESC で取得
2. 今日から逆順に連続日数をカウント
3. 最初の欠損日で break
4. `profiles.streak_days` を更新、条件付きで `longest_streak` も更新

特殊ケース:
- 今日未入力:streak は昨日の値のまま、0 にリセットしない
  → 実装:`submitEntry` 時にだけ再評価、ページロードごとに再評価しない
- タイムゾーン:全計算は JST

## 8. 過去エントリ callback(γ stage モデル、v0+)

> **ADR-017** に基づく。`/today/done` で「向こうから来る」surfacing 軸を実現する。**ADR-016**(AI は引用係、解釈しない)に準拠 ─ Phase 0 実装は AI 呼び出しを含まないが、原則は適用される。

### トリガー位置
`/today/done` ページ、`submitEntry` 成功後。Server Action `selectCallbackEntry()` がページレンダー時にサーバー側で呼ばれる。non-null が返ったら、streak 数字と「おやすみ」コピーの下に callback カードを描画する。

### カウント単位
**現ユーザーのエントリ数**(= `completed_at NOT NULL` な `entries` 行数)。カレンダー日数ではない。スキップ日が cadence に影響しない。

### Stage アンロックスケジュール

| ステージ | 書いた回数のしきい値 | 対象「N entries ago」範囲 | 表示ラベル |
|---|---|---|---|
| 1 | ちょうど 5 回(deterministic) | 2-4 entries ago | 「数日前のあなた」 |
| 2 | 12-15 回(範囲内で初回 trigger) | 7-10 entries ago | 「もう少し前のあなた」 |
| 3 | 21-25 回 | 14-20 entries ago | 「ひと月近く前のあなた」 |
| 4 | 30+ 回 | 約1ヶ月前(28-35 entries ago)| 「ひと月前のあなた」 |
| 5+ | 成長に応じてスケール | 約ひと季節前(90 entries ago)など | 「ひと季節前のあなた」など |
| Anniversary | 最初のエントリから365日経過 | 1年前の同月同日 | 「1年前のあなた」 |

Stage 1 は **5回目のエントリで deterministic に発火**。これがオンボーディングのフック ─ 1週間以内に確実に体験させ、Phase 0 セルフテストの再現性も担保する。

Stage 2 以降は *対象 entry-count ウィンドウ内の最初の eligible day* に発火。例えば Stage 2 は cool-down 状態次第で entry 12, 13, 14, 15 のいずれかで発火する。

Anniversary callback は **カレンダー時間ベース**(entry-count ベースじゃない):`entry_date = today − 365 days` のカレンダー日に発火する。その日に該当する場合、確率的な refire を上書きする。

### クールダウンと再発火

**何らかの callback が発火した後**(stage か refire か関係なく)、`last_callback_at = now` を set。

- **Cool-down**:`last_callback_at` から 3-4 日。Cool-down 中は `selectCallbackEntry()` が無条件で `null` を返す
- **Cool-down 後**:1日あたり 30-40% の発火確率
- **Refire 元**:**既に unlock された範囲**のいずれかからランダムな entry を引く。新しい stage が unlock されても、古い stage は引き続き対象

これでだいたい30日で 7-8回の callback(平均 3-4 日に1回)、ユーザーの履歴が増えて stage が広がるにつれて薄くなる。

### 範囲内の選択

1. 対象 entries を計算:完了済みエントリのうち、新しい順での位置が対象範囲に入るもの
2. Q2 自由記述が空のエントリを除外(本文がないと表示できない)
3. ランダム選択

候補セットが空(=ユーザーがスキップが多くて該当範囲にエントリがない)の場合、`selectCallbackEntry()` は `null` を返し、`last_callback_at` は更新しない(翌日リトライできるように)。

### 状態保存

`profiles` に追加(v0 migration は ADR-012 のスキーマ変更と同じ migration に含める):

```sql
ALTER TABLE profiles
  ADD COLUMN last_callback_at timestamptz,
  ADD COLUMN unlocked_stage   integer DEFAULT 0;
```

Stage の入り口は `unlocked_stage` と現エントリ数から deterministic に計算可能だが、`unlocked_stage` を明示的に保存しておくことで、後から stage しきい値を調整したときの曖昧さを避ける。

### UI(概要)

streak の下に小さなカード。形(デザインで詰める):

```
┌───────────────────────────────────────┐
│ 数日前のあなた                        │
│                                       │
│ 5月12日  ⛅                           │
│ 「会議で〇〇さんに…(本文)」          │
└───────────────────────────────────────┘
```

カードに AI コメントは入れない。ラベル(「数日前のあなた」等)は stage ごとにテンプレ生成。

### ADR-016 への準拠

- カードに要約・ラベル・解釈は出さない
- ユーザー自身のエントリ本文を verbatim で表示
- ラベルは時間距離を指すだけ、内容を指さない

### 将来拡張(Phase 0 後)

- **同じ体感の日 callback**(v1.0):「今日と同じ体感だった日のあなた」を stage callback と交互に。Q1 身体感覚が一致する古いエントリから選択
- **週次語 callback**(v1.0+):「今週よく出てきた言葉」 ─ 純粋なキュレーション、AI 要約なし。フォーマット TBD
- **年次振り返り**(v1.1+):年間まとめを別の curation surface として

---

## 9. AI 月次レポート(v1.1)

> ⚠️ 以下のプロンプトテンプレートは ADR-016 より前。`summary_text` 出力フィールドがユーザーを description する ─ これは **ADR-016 が禁じている** こと。**v1.1 実装前に、出力スキーマとプロンプトを丸ごと再設計する必要がある**。物語的要約ではなく、curation の primitive(top phrases、対比される日、ハイライト entries)を出すように。下記は参考用に残してあるだけ。

### トリガー
Vercel Cron:`0 0 1 * *`(毎月1日、00:00 UTC = 09:00 JST)

### ユーザーごとの処理
1. 前月の全エントリを取得
2. 5件未満ならスキップ(信号不足)
3. プロンプト構築(下記)
4. Claude Sonnet 4.6 を structured output で呼び出し
5. JSON レスポンスを parse
6. `monthly_reports` に insert
7. プッシュ通知

### プロンプトテンプレート

```
あなたは「ほしふみ」という寝る前ジャーナルアプリのAI分析アシスタントです。
ユーザーが1ヶ月間記録した日々の振り返りを分析し、優しく洞察を返してください。

## 入力データ
{entries as JSON}

## 出力フォーマット (必ずJSON)
{
  "summary_text": "今月のあなたを2-3段落で...",
  "numerical_trends": {
    "mood_avg": <平均気分1-5>,
    "completion_rate": <記録率0-1>,
    "trend": "<up|stable|down>"
  },
  "word_frequencies": {"<よく出た言葉>": <回数>, ...} (上位10語、ストップワード除外),
  "highlight_entry_ids": [<印象的だった3日のentry_id>],
  "patterns": [
    {"type": "weekday", "insight": "..."},
    {"type": "trend", "insight": "..."}
  ]
}

## 大切なルール
- 「やりたかったけどできなかった」を責めない
- 数値だけでなく、ユーザーが書いた言葉を引用する
- 「あなたは○○な人です」と決めつけない
- 不安や悲しみが見えても、医療的アドバイスはしない
- 自殺・自傷の兆候が見えた場合、必ず よりそいホットライン (0120-279-338) を提示
```

### コスト見積もり
- 入力:約3,000 tokens(30日 × 100 tokens 平均)
- 出力:約1,500 tokens
- Sonnet 4.6:約 $0.04 / レポート ≈ ¥6
- Pro ユーザー1人:月1レポート = ¥6 コスト vs ¥480 売上 = AI 粗利 98.75%

## 10. データバリデーション

### クライアント側

- Email:HTML5 type="email"
- 自由記述:最大2000文字、1500文字でソフトワーニング
- 必須フィールドは質問ステップ進行前にチェック

### サーバー側
- 全 Server Action が任意の DB 操作前に `auth.uid()` を検証
- スキーマ制約(CHECK, NOT NULL)で invalid 値をキャッチ
- 自由記述:trim、trim 後に空なら reject

## 11. エラー処理

### Server Actions
- 認証失敗は throw、ユーザー表示エラーは error オブジェクトを返す
- Vercel Logs(builtin)に出力
- v1.1+:Sentry 等を統合

### UI
- `useTransition` で pending state
- エラーはアクションボタンの下にインライン表示
- raw エラーメッセージはユーザーに見せない、日本語の friendly な文言にマップ

## 12. パフォーマンス目標

- `/login` の TTI:4G で < 1.5s
- `/today` の TTI:4G で < 2.0s
- セッション完了時間:中央値 約5分(儀式であってスパートじゃない)、パフォーマンスの関心は各ステップ内のレスポンシブネスであって、セッション全体の長さではない
- Lighthouse Performance スコア:モバイルで >= 90

## 13. アクセシビリティ

- 全インタラクティブ要素:キーボードアクセシブル、必要箇所に ARIA labels
- カラーコントラスト:WCAG AA 最低
- タップターゲット:最低 44x44pt(Apple HIG)
- `prefers-reduced-motion` を尊重

## 14. セキュリティ

### 入力サニタイゼーション
- 自由記述は as-is で格納(どこでも HTML レンダリングしない、常にプレーンテキスト表示)
- ユーザーコンテンツのパスで `dangerouslySetInnerHTML` 禁止

### シークレット
- API キーは client に送らない
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー側でのみ使用、client コンポーネントで import 禁止

### レートリミット
- Magic Link 送信:Supabase デフォルト(60s クールダウン)
- Server Actions:Vercel デフォルト(MVP では rate limit なし、v1.1 で upstash を追加)

## 15. 未解決の論点 / 将来の意思決定

1. **カスタムテンプレート UI**:「ユーザーが scaffolding 質問を作る」設計をどう?v1.1 実装前にモックアップ必要(AI follow-up は universal でテンプレ非依存)
2. **プッシュ通知 opt-in フロー**:いつ permission を要求?Day 3 後?最初の完了後?
3. **Pro の無料トライアル**:7日?14日?なし?
4. **年額ディスカウント**:12ヶ月で10ヶ月分(¥4,800)?
5. **解約フロー**:ソフトな「本当に?」+ win-back オファー?

解決済みの問いは `docs/DECISIONS.md` 参照。
