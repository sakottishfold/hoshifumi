# アーキテクチャ意思決定記録(ADR)

> 主要な設計・アーキテクチャ上の意思決定と、その根拠の記録。
> Claude Code が「なんでこうなってる?」と思ったときに、まずここを確認。

---

## ADR-001: なぜ3問?1問でも5問でもなく

**日付**: 2026-05-10
**ステータス**: ADR-011 により上書き(2026-05-14)

### 背景
1日あたりの質問数を決める必要があった。

### 検討した選択肢
- **1問**: フリクション最小だが、価値構築には薄すぎる
- **3問**: 軽いが豊かさは十分
- **5問以上**: 重すぎる、「軽さ」のポジショニングを損なう

### 決定
**3問**、以下の構造:
- Q1: 定量(1-5 スケール等)
- Q2: 定性(自由記述)
- Q3: 前向き(選択 or 短文)

### 根拠
3問なら約30-60秒で完了、寝る前の習慣に収まる。定量・定性・前向きの構造で:
- 月次トレンドを可視化するための数値データ
- AI パターン抽出のためのリッチな内容
- ポジティブな前向きの締め(心理的)

### 影響
- テンプレートは常にちょうど3問(スキーマで CHECK 強制)
- 「Mittsu(三つ)」をプロダクト名に
- 4問以上の追加は明示的に禁止

---

## ADR-002: answers はマルチカラム、JSON blob ではない

**日付**: 2026-05-10
**ステータス**: 承認済み

### 背景
各 answer は `value` を持つが、型が様々(数値・テキスト・選択)。

### 検討した選択肢
- **マルチカラム**(現状):`value_number` / `value_text` / `value_choice` を別々の nullable カラムに
- **JSON カラム**:`value jsonb` で型付き payload
- **型ごとの別テーブル**:`mood_answers` / `text_answers` 等

### 決定
マルチカラム、各行で1つだけ埋まる。

### 根拠
- シンプルな SQL クエリ(分析用に JSON parse 不要)
- インデックスの型安全性(`value_number` を数値としてインデックス化可能)
- AI プロンプト構築への投入が容易
- 3カラム増えるが多くの行で2つが NULL ─ Postgres のストレージオーバーヘッドは無視可能

### 影響
- 新しい入力タイプ追加にはスキーママイグレーション要(例:`value_photo_url` 追加)
- アプリコードが `question.input_type` に基づいてどのカラムを読むか「知る」必要あり

---

## ADR-003: Server Actions、API Routes ではない

**日付**: 2026-05-10
**ステータス**: 承認済み

### 背景
Next.js 15 ではミューテーションに Server Actions と API Routes の両方がある。

### 決定
**ユーザー向けミューテーションは全部 Server Actions**。API Routes は Stripe webhook / Vercel Cron / OAuth callback のみ。

### 根拠
- End-to-end の型安全(API 契約のずれなし)
- 自動 CSRF 保護
- シンプルなクライアントコード(`fetch` ラッパー不要)
- 使うページと近接配置
- 将来の RSC ストリーミング恩恵

### 影響
- 外部クライアントから呼べない(問題なし。そもそも望んでない)
- デバッグ体験がやや異なる(Network タブで見えない)─ Vercel Logs で軽減

---

## ADR-004: v0 ではテンプレをハードコード、DB ではない

**日付**: 2026-05-10
**ステータス**: 承認済み、v1.1 で再考

### 背景
テンプレートは TypeScript にハードコードするか DB に格納するか。

### 決定
v0 では `BASIC_TEMPLATE` 定数でハードコード。`templates` DB テーブルはカスタムテンプレ出荷時(v1.1)に追加。

### 根拠
- v0 はテンプレ1つだけ、DB 化はオーバーキル
- TS リテラル型のほうが型安全が容易
- コードレビューでテンプレ変更を補足できる(隠れた DB migration よりよい)
- 必要になるまでスキーマ複雑度を先送り

### 影響
- v0/v1.0 ではテンプレ変更にコードデプロイ要
- v1.1 で migration 必要:TypeScript 定数 → DB seed

---

## ADR-005: v0 では JST タイムゾーンのみ

**日付**: 2026-05-10
**ステータス**: 承認済み

### 背景
最初から国際ユーザーをサポートすべきか?

### 決定
v0/v1.0 は日本のみ(JST)。国際対応は無期限延期。

### 根拠
- ターゲット市場は日本
- タイムゾーン正しくサポートするのは大仕事(一部国の DST、曖昧な日付等)
- 個人開発者が仮想ユーザーのためにこのコストを払うべきではない
- マイグレーションパスはある:`profiles.timezone` カラムは既に存在

### 影響
- 全日付処理は `Asia/Tokyo`(`lib/utils/date.ts`)
- 非日本ユーザーは JST を日境界として使うことになる(混乱するだろうが明示的な non-goal)

---

## ADR-006: Tailwind v4、v3 ではない

**日付**: 2026-05-10
**ステータス**: 承認済み

### 背景
Tailwind v4 がリリースされたばかり。v3 が長く安定版。

### 決定
**Tailwind v4** を `@theme` ブロックで使う。

### 根拠
- v4 は安定、プロジェクトの将来性確保
- パフォーマンス向上(`@tailwindcss/postcss` 以外の PostCSS プラグイン不要)
- CSS-first 設定が理解しやすい
- カラートークンが OKLCH(知覚的に均一)

### 影響
- `tailwind.config.ts` は使わない(設定は `app/globals.css` の `@theme` ブロック)
- 一部の v3 プラグイン(`tailwindcss-animate` 等)は動かない可能性 ─ CSS or 代替を使う
- フロントエンド開発者を雇う場合、v4 を学ぶ必要あり

---

## ADR-007: Magic Link、パスワード / Google OAuth ではない

**日付**: 2026-05-10
**ステータス**: 承認済み

### 決定
v0 は **Magic Link のみ**。コンバージョンが落ちたら v1.1+ で OAuth(Google)追加。

### 根拠
- パスワードリセットフロー構築不要
- パスワードセキュリティ監査不要
- フリクション低い(パスワード作成・記憶不要)
- 日本特有:パスワードマネージャ未使用ユーザー多い、Magic Link のほうが実質安全
- OAuth は複雑度を上げる(プロバイダ設定、リダイレクト URI 管理、プロフィール sync)

### 影響
- メール到達性が critical(ローンチ前に Supabase デフォルトから移行必須)
- メールアクセス失ったユーザーはアカウント回復不可
- 伝統的な意味での「remember me」なし(セッションクッキーで対処)

---

## ADR-008: streak 罰なし / ゲーミフィケーションなし

**日付**: 2026-05-10
**ステータス**: 承認済み(プロダクト価値)

### 背景
ほとんどの習慣アプリは罰する streak カウンタを使う(「47日連続が途切れました!」)。

### 決定
**streak カウンタは存在するが決して罰しない**。「1日抜けました!」UI なし。バッジなし、リーダーボードなし、恥なし。

### 根拠
- ターゲットユーザーは過去にジャーナリングに失敗した層 ─ さらなる恥は不要
- variable reward / ゲーミフィケーションは不安を生む、プロダクト目的の真逆
- Anti-goal: Duolingo にはならない

### 影響
- streak リセットは静か
- v1.0 で「休みの日」機能を検討(週1スキップでリセットしない)
- マーケコピーは streak を強調しない

---

## ADR-009: 月次 AI レポート、週次ではない

**日付**: 2026-05-10
**ステータス**: 承認済み

### 決定
AI 生成レポートは **月次** cadence。

### 根拠
- 週次はノイズが多い(1週間 ≈ 7データポイント、パターン検出に不十分)
- 月次は高い期待値イベント(「あ、今日レポートだ」)
- コスト:月次は約¥6/user、週次なら約¥25
- 課金サイクルとアラインする

### 影響
- 月中入会ユーザーは初回レポートまで最大30日待つ
- v1.1 で cooldown 付きの「今すぐレポート要求」追加可能

---

## ADR-010: `monthly_reports.patterns` は JSON 格納、リレーショナルではない

**日付**: 2026-05-10
**ステータス**: 承認済み

### 背景
AI 生成パターンは構造が様々。

### 決定
`jsonb` カラムで格納。

### 根拠
- AI 出力には schema-on-read が適切(構造が進化する可能性)
- 個別パターンフィールドをクエリしない
- 表示は「全レポートを読む」、「パターン X を持つユーザー全リスト」ではない

### 影響
- パターン形状の関係整合性なし
- スキーマは Claude の出力フォーマットで強制(parse 後に TypeScript schema で validation)

---

## ADR-011: 「3問60秒以下」から「寝る前の5分の儀式」へピボット

**日付**: 2026-05-14
**ステータス**: 承認済み
**ADR-001 を上書き**

### 背景
Phase 0 セルフテスト設計のブレストで、元のフレーミングに2つの懸念が浮上した:

1. 「3問」は活動を記述しているだけで、目的を語らない。ユーザーになぜ気にすべきか伝えない
2. 「60秒以下」目標は浅い入力を促す。Q2(「今日いちばん印象に残ったこと」)は「疲れた」のような単語1つしか集まらない ─ 内省のシグナルゼロ

オーナーは3問制約への不満を明示的に表明(プロダクト名「みっつ」も含む)。

### 検討した選択肢
- 3問を残し、Q2 を内省を誘うように書き直す(保守的すぎる)
- Adaptive:忙しい日は30秒、話せる日は5分(コンセプトがぼやける)
- **「寝る前の5分」を儀式コンセプトとしてフルコミット(採用)**
- 日次気分 ping + 週次深掘り(プロダクトが分裂する)

### 決定
プロダクトを **「寝る前の5分、自分と向き合う儀式」** にリポジショニング。

主要シフト:
- コンセプトを活動ではなく目的で表現
- セッション長の目標:約5分(短縮モードなし)
- 就寝時間にアンカー(既存睡眠ルーチンに habit stacking)
- 「3問」は制約ではなくなる、質問数は設計パラメータに
- Anti-goal「スキップ日を罰しない」は維持 ─ スキップ OK だが、セッション内短縮モードはなし

### 根拠
- 「儀式」という強いアイデンティティが活動記述「3問答える」に勝る
- 既存就寝ルーチンへの habit stacking は retention 優位が文献的に確立
- 寝る前文脈は自然に内省を誘う(心が減速する)
- PRD の primary persona は既に「就寝前5-10分」 → プロダクト側がずれていた
- Day One / Apple Journal / Daylio との差別化(「寝る前の5分」を所有しているプレイヤーはいない)

### 影響
- ADR-001(3問制約)は上書き
- PRD v1.0 ゴール「60秒以内に完了」は「5分中央値セッション」に書き直し必要
- PRD のペルソナ / 指標 / ポジショニング各章を見直し必要
- プロダクト名「みっつ」(三つ)は改名候補、決定は延期
- DB スキーマ `answers.question_position CHECK BETWEEN 1 AND 3` を緩める必要(ADR-012 参照)
- 通知時間(デフォルト 22:00 or ユーザーの就寝時間)は設定ではなくコア機能に
- Anti-goal「スキップ日を罰しない」がより重要に(就寝時の儀式は脆い)

### 未解決の論点
- ~~新プロダクト名(延期、「みっつ」を placeholder のまま)~~ **ADR-015 で解決**
- 5ステップフローの詳細 UX(2026-05-14 のブレストで口頭設計、まだ仕様化・実装なし)

---

## ADR-012: AI follow-up を v2.0 Premium から v1.0 日次コアへ移動

**日付**: 2026-05-14
**ステータス**: 承認済み(directional)、詳細設計は TBD

### 背景
PRD では AI 対話を v2.0 Premium 機能としていた。ADR-011 のコンセプトピボット後、内省が中心になった。ローテーション静的プロンプトも検討したが、ユーザーがローテーションパターンを学習してしまい深さが plateau するので却下。

### 決定
各日次セッションに **AI 生成 follow-up 質問1つ** を、固定 Q2 と固定 Q3 の間に挿入。Claude が Q1(身体感覚)+ Q2(出来事)を読み、可能ならユーザー自身の言葉を引用して個別化された「why」or「what」質問をする。

### 根拠
- ローテーション静的プロンプトは非個人的、ユーザーがパターン学習してしまう
- AI 生成質問はユーザー自身の言語を返せる(「『悔しい』って書いたね、どんな悔しさ?」)
- 1日1 follow-up はコストを抑える(Haiku 4.5:期待トークン量で約¥3-9/user/月)
- 「5分の儀式」のペース感に綺麗にマップ ─ 固定 scaffolding 間の AI の呼吸ひとつ
- 2-4s の API latency がこの文脈では *機能* になる(寝る前の pause は歓迎)

### 影響
- AI が日次ユーザー向けパスに入る(月次 cron だけじゃない)─ PRD 安全ルール(医療アドバイスなし、危機ホットライン注入)が日次入力時に適用される
- Latency 予算:Claude call の 2-4s にはローディング affordance 必要だが、儀式感を壊さない
- 価格モデル要見直し:Free tier に日次 AI follow-up あり?
- DB スキーマ:AI 生成質問テキストをエントリごとに保存必要(テキストは日替わり)。`answers` に新規 `question_text` カラム(固定 Q は nullable)を追加が有力
- `question_position` CHECK 制約を `1..3` から `1..5` に変更(または削除)必要

### 未解決の論点
- Single-turn(AI 質問1つだけ)vs multi-turn(ユーザーが止めるまで AI が問い続ける):まず single-turn から
- 失敗時:Claude API が失敗 or タイムアウトしたら、Q3 に静かにスキップか、リトライ表示か?
- Free vs Pro の境界線:未決。Free = 1 follow-up/日 with rate limit、Pro = multi-turn が有力
- ~~プロンプト設計 / システムプロンプト / 安全ガードレール:未起草~~ **ADR-016 で部分解決**:AI follow-up はユーザー自身の言葉を引用して問う、要約しない。フルプロンプト起草は依然 pending。

---

## ADR-013: Q1 を「気分」から「身体感覚」に再定義

**日付**: 2026-05-14
**ステータス**: 承認済み

### 背景
ADR-011 の「寝る前の5分の儀式」フレーミングは、抽象的な気分よりも別の入口の方が相性が良い。マインドフルネスと somatic 系の伝統は身体から入る ─ ユーザーを減速させるから。

### 決定
Q1 を「今日の気分は?」から **「いまの体の感じは?」** に変更。

選択肢を改訂:
- 🌧 重たい
- ☁ ざわざわ
- ⛅ ふつう
- ☀ 軽い
- 🌟 軽やか

(旧:つらい / もやもや / ふつう / いい感じ / 最高)

### 根拠
- 身体先行の入口がユーザーを減速させる ─ 寝る前儀式に望ましい効果
- 「今日の気分」は遡及的(「今日はどうだった」)、「いまの体」は現在形 ─ 「いまの自分と向き合う」とよくマッチ
- 身体語(「重たい / ざわざわ」)は気分語(「つらい / もやもや」)より judgment 負荷が低い、自己批判なしに記録しやすい
- 必要に応じて分析で気分にマップ可能(重さは低気分と相関)、自己評価を強制せずに

### 影響
- AI 月次レポートの「mood_avg」トレンド解釈に再解釈必要(気分ではなく身体感覚)
- Q1 ラベルと絵文字セット変更、スキーマ変更不要(まだ `value_number 1-5`)
- `lib/constants/template.ts` の `MOOD_OPTIONS` 定数を `BODY_SENSATION_OPTIONS` に改名

---

## ADR-014: Q3 を「5択前向きメッセージ」から「自由記述 closure」に再定義

**日付**: 2026-05-14
**ステータス**: 承認済み

### 背景
元の Q3 はチップ5択(「がんばれ / ゆっくりしよう / 今日はOK / 昨日のままで / なにか変えたい」)。新しい儀式フロー(ADR-011)では、AI follow-up(ADR-012)が深掘りを担う。Q3 の目的は純粋な **closure** に絞られる ─ 寝る前に今日の残滓を手放す。

### 決定
Q3 を `short_choice` から `free_text` に変更。プロンプト:**「明日の自分にひとことだけ」**(短く、1行)。

### 根拠
- 5択はユーザー自身の言葉のほうが活きる瞬間を制約する
- AI 深掘りの後に事前定義チップに戻ると構造的に jarring
- 短い自由記述「明日へ預ける」が認知的 closure として機能 ─ 1日を packing し、入眠を支援
- 緩い文字数上限(約40文字推奨)で closure を軽く保つ、もう1段落にしない

### 影響
- DB 格納が Q3 で `value_choice` から `value_text` にシフト
- `SHORT_MESSAGE_OPTIONS` 定数は未使用に、削除可能
- 構造化された「intent」データの損失(チップカテゴリは clean な分析シグナルだった)─ 受容、AI 月次レポートで自由記述から intent を抽出可能

---

## ADR-015: プロダクト名を「みっつ」から「いとなみ」へ

**日付**: 2026-05-14
**ステータス**: 承認済み;名前の choice は ADR-018 により上書き(2026-05-16)。「みっつ」から離れる行為自体は有効。
**ADR-011 の "新プロダクト名" を解決**

### 背景
同日 ADR-011 でプロダクトコンセプトを「3問60秒以下チェックイン」から「寝る前の5分の儀式」にピボットした。「みっつ」(三つ = "三つのもの")は活動数を記述しており、新コンセプトのオープンな質問数と儀式フレーミングと両立しない。

### 検討した選択肢
複数方向でブレスト後:
- コンセプト直結の日本語(いとなみ / うつし / ともしび / しおり)
- 詩的・比喩的な日本語(つむぎ / ひととき / しじま / ことのは)
- 「見つめ直す」ニュアンスの日本語(かえりみ / あらため / まなざし / かがみ)
- 英語の抽象現象(Embers / Lull / Linger / Hush)─ Gravity 風ポジショニング

### 決定
**いとなみ (itonami)**。

- 表示ブランド:**いとなみ**(ひらがな)
- ASCII ハンドル / package 名 / slug:**itonami**
- リポジトリフォルダ名は `mittsu/` のまま(物理リネームは別タスク、ブロッキングではない)

### 根拠
- 「営み」は「日々の実践 / 生き方」を意味 ─ 活動の **質** を記述、数ではない。ADR-011 の目的優先リフレーミングと一致
- タグライン候補:「今日のいとなみに、5分だけ」 ─ 自然にハマる
- Phase 0 を超えて持続できる抽象度(将来の朝使用等への拡張が改名なしで可能)
- 4モーラ、言いやすい、シンプルな ASCII slug
- ユーザーがさらなる選択肢(Gravity 風英語抽象、古典日本語等)を探索した上で戻ってきた ─ 選択は informed、デフォルトではない

### 影響
- ユーザー向けコピーを全部変更:「みっつ」 → 「いとなみ」(CLAUDE.md, README, PRD, SPEC, ROADMAP, DEPLOYMENT, API-REFERENCE, app/today/page.tsx, components/AppHeader.tsx, app/today/_components/QuestionFlow.tsx, app/today/done/page.tsx, app/calendar/[date]/page.tsx)
- `package.json` の `name` フィールド:`mittsu` → `itonami`
- フォルダ/レポ物理リネームは延期:アクティブ作業中のシェルパス churn を避ける。別 TODO として追跡。
- マーケ素材(LP、OG image、アプリアイコン)は v1.0 出荷時に作り直し必要
- App Store / ドメイン名:未取得、なのでマイグレーションコストなし

### 未解決の論点
- ドメイン名取得(itonami.app / itonami.jp / etc.)─ v1.0 launch 準備まで延期
- ~~ロゴ / アイコンデザイン(現状 🌱 絵文字を placeholder のまま)~~ **2026-05-16 解決**:細い waxing 三日月(warm cream `#f5d49a`)を deep indigo(`#0f0f23`)正方形に。SVG マスター `public/icon.svg`、PWA/apple-touch 用 PNG 生成済み。アプリ内絵文字参照(login, AppHeader, BASIC_TEMPLATE)を 🌱 から 🌒 に変更。「夜、ふとんから星を見上げる」世界観と一致(CLAUDE.md の "Critical Architectural Decisions" 内の worldview ノート参照、将来 `docs/WORLDVIEW.md` に独立予定)。

---

## ADR-016: AI は引用係、解釈者ではない(引用係原則)

**日付**: 2026-05-16
**ステータス**: 承認済み

### 背景
ADR-012 で AI follow-up を v1.0 日次コアに昇格させたが、AI が何を言ってよいかは未指定だった。2026-05-16 のブレストで、オーナーがより強いプロダクトビジョンを表明:**寄り添う(companion tone) + 手軽だけど深く(progressive depth) + 蓄積されて自分の財産になる(record accumulates into a personal asset)**。

特に「財産」のフレーミングが含意するのは、**ユーザー自身の言葉が記録の protagonist であり続ける**べきこと。AI の解釈 ─ ラベリング、要約、診断、助言 ─ はユーザーを分析される対象に押し下げ、これは companion tone と長期的なアーカイブ価値の両方を損なう(AI コメントがアーカイブの voice になり、ユーザーのものではなくなる)。

線引きを探った。許可:引用、surface、curate、問い返し。不許可:ラベリング、要約、診断、助言、予測。

### 検討した選択肢
- AI 要約を許可するが restraint ガイドライン付き(却下:指定困難、drift しやすい)
- 月次のみ要約を許可(却下:依然「AI があなたを分析する」方向にブランドを引く)
- **AI を全 surface で厳密に「引用係」にする(採用)**

### 決定
**いとなみ AI は引用係であって解釈者ではない**。これはプロダクト内の全 AI surface に適用される(日次 follow-up、月次レポート、callback、将来機能を全て)。

**AI が許可されること**:
- ユーザー自身の言葉を verbatim で引用して返す
- 過去エントリを surface する(時間別、類似性別、curate された選択)
- ユーザー自身の言葉を参照する follow-up 質問(「『悔しい』って書いたね、それは?」)
- エントリを curate / juxtapose してユーザーにパターンを可視化 ─ パターンを名付けずに

**AI が禁止されること**:
- ユーザーを要約する(「今日は productive な日だった」「今月は内省的だった」)
- カテゴリラベルを付ける(気分状態、性格タイプ、ストレスレベル、テーマ)
- 診断 or 診断の hint を出す
- 助言、推奨、予測
- 明示的解釈付きで「パターン」を検出・告知する

ユーザーが全解釈をする。AI は選択と配置の仕事をする。

### 根拠
- **ブランド差別化**:他のジャーナリング AI は「AI に分析させる」を売っている。逆の立場のほうが defensible、寄り添いポジショニングと一貫
- **安全性**:一群の harm を排除 ─ 不正確なラベリング、医療隣接コメント、不安喚起要約。PRD 安全制約を満たしやすい
- **蓄積価値の整合**:AI が引用すると、ユーザーの voice がアーカイブの protagonist のまま。AI が解釈すると AI の voice が侵入、長期記録を希釈する
- **プロンプトエンジニアリングがシンプル**:「要約するな、ラベル付けるな」ルールは、nuanced な interpretive ガイドラインより指定・テスト・監査が容易

### 影響
- **ADR-012(日次 AI follow-up)**:follow-up 質問はユーザー自身の言葉を参照して問う、要約しない。システムプロンプト設計はこれに従って制約される
- **AI 月次レポート(PRD §8 / SPEC §9)**:v1.1 実装前に再設計必要。現 SPEC のプロンプトテンプレは `summary_text` フィールドでユーザーを description する ─ これは原則違反、curation の primitive(top phrases、対比される日、ハイライトエントリ等)に置換必要
- **Past-entry callback(ADR-017)**:過去エントリを verbatim で日付 + body 絵文字付きで表示、エントリに AI コメントなし
- **AI の体感価値** は *選択と配置* から来る、コメントからではない。UI / コピー設計の重み増(引用を面白く見せるのは要約を貼るより難しい)
- **将来の AI 機能** はこの原則に照らして設計される。迷ったら:「これは引用?それとも解釈?」

### 未解決の論点
- エッジ:ユーザーが明示的に AI に「最近どうなってる?」と聞いたら、AI はルールを破るか?おそらく No ─ AI は引用 + 配置で応答可能、要約なしで ─ ただし期待ギャップの UX に対応必要
- 月次レポートプロンプト再設計:v1.1 が近づいた専用 ADR で扱う

---

## ADR-017: `/today/done` 上の Past-entry callback(γ stage モデル)

**日付**: 2026-05-16
**ステータス**: 承認済み

### 背景
2026-05-16 に確定したプロダクトビジョンに含まれる **「蓄積されて自分の財産になる」** ─ 日々の記録は長期的価値に蓄積されるべき。現実装は素のカレンダーグリッド以外「見返す」最適化がゼロ:ユーザーはエントリを書くが、再訪する理由がない。

成功している「メモリ再 surface」アプリ(Photos Memories、Day One "On This Day"、Spotify Wrapped)は全部 **proactive surfacing** を使う ─ 過去エントリがユーザーに来る、逆ではない。「向こうから来る」を設計軸として採用。

**Phase 0 セルフテスト**(30日オーナーテスト)では特に重要:past-callback 機能がなければ、テスト全体が「蓄積が valuable」体験の検証なしで終わる。オーナーは最初の週に callback が出ることを明示的に望んだ(「こういうのもあるんだ、いいな」モーメントで feature discovery を早期 seed)。

cadence の形を検討:
- (α) 最小 cool-down + 1日あたりの確率
- (β) 頻度が時間とともに緩やかに低下
- (γ) Stage ベース、新しい「時間距離」範囲が entry-count マイルストーンで unlock

配置を検討:
- `/today` 上(書く *前*) ─ 「向こうから来る」感は強いが、過去エントリが今日の書き内容を contaminate するリスク
- `/today/done` 上(書く *後*) ─ closure 後の小さな贈り物として過去エントリが届く

### 決定
**γ stage モデル、cool-down refire 付き、`/today/done` 表示**。

**Stage unlock スケジュール**(書いたエントリ数でカウント、カレンダー日数ではない):

| Stage | トリガー(書いた回数)| 範囲 | ラベル |
|---|---|---|---|
| 1 | ちょうど 5 回 | 2-4 entries ago | 「数日前のあなた」 |
| 2 | 12-15 回 | 7-10 entries ago | 「もう少し前のあなた」 |
| 3 | 21-25 回 | 14-20 entries ago | 「ひと月近く前のあなた」 |
| 4 | 30+ 回 | 1ヶ月前あたり | 「ひと月前のあなた」 |
| ...続く... | | | 「ひと季節前」など |
| N(anniversary) | カレンダー上で1年経過 | 1年前の同月同日 | 「1年前のあなた」 |

**Stage 1 は5回目のエントリで deterministic に発火**(= 最初の週のオンボーディングフック)。Stage 2 以降は entry-count ウィンドウに入った時に確率的に発火。

**Stage 間の refire**:何らかの callback 発火後、**cool-down 3-4 日**。Cool-down 後、**1日あたり 約30-40% の発火確率**。選択:**既に unlock された範囲**のいずれかからランダム選択。

**範囲内の選択**:範囲内のランダムエントリ。Q2 自由記述が空のエントリはスキップ。

**日数カウント**:このユーザーが書いた entries 数。スキップしたカレンダー日はカウントしない。Anti-goal「スキップ日を罰しない」(ADR-008)と一貫。

**位置**:`/today/done` の既存の streak 数字と「おやすみ」行の下。Visual デザインは TBD。

### 根拠
- **Stage ベースのナラティブ**:各 stage 発火は小さなストーリーモーメント ─ 新しい「時間距離」の reveal。「数日前」 → 「もう少し前」 → 「ひと月前」 → 「ひと季節前」 → 「1年前」 という progression は、競合がこの形でフレーミングしていない自然な感情的アーク
- **早期フックの信頼性**:Stage 1 がエントリ5でちょうど発火 = ユーザーが最初の週に機能に出会うことを保証。Deterministic 発火が Phase 0 セルフテストの再現性を確保
- **持続可能な cadence**:Stage イベント + cool-down refire で、30日で約 7-8 callback(平均 3-4 日に1回)。「ふと出てくる」性質を保ちながら、寂しくない頻度
- **今日のエントリの純度**:Done ページに配置(送信後)で、今日の書き内容が過去エントリに影響されない
- **ADR-016 と互換**:callback は過去エントリを verbatim で日付 + body 絵文字付きで表示。解釈なし、コメントなし
- **身体感覚軸が将来の深さをアンロック**:似てる体感の日 callback(v1.0 へ延期)が stage callback と並ぶ追加 callback タイプとして plug-in 可能

### 影響
- `/today/done` に新規 UI コンポーネント:日付 + body 絵文字 + 自由記述を表示する callback カード
- 新規 Server Action(例:`selectCallbackEntry`):ユーザー履歴、unlocked stage、cool-down 状態から判定 ─ callback を出すか、どのエントリを出すか、どのラベルか
- 新規 `profiles` カラム(または小さい `callback_state` テーブル):`last_callback_at`、`unlocked_stage`。レンダーごとの再計算を避け、cool-down ロジックをサポート。Migration TBD
- Phase 0 セルフテストでは callback 発火を log する、実使用で発火するか検証
- 前方互換:似てる体感の日 callback(v1.0)と他のバリエーション(週次まとめ等)が追加 callback タイプとして plug-in 可能

### 未解決の論点
- **callback カードの Visual/UX**(Phase 0 実装詳細、デザイン pending)
- **エッジケース**:
  - 範囲内にエントリがない(スキップが多くて該当範囲に該当エントリなし):このラウンドの callback を静かにスキップ
  - 過去エントリを表示後に編集された:再表示するか?スキップするか?
  - 「この日は見たくない」 ─ opt-out 粒度 TBD
- **2年目以降の挙動**:365日後、「1年前のあなた」が anniversary として再発。さらに年を重ねたら Year-2/Year-3 スタック(「2年前のあなた」「3年前のあなた」)?おそらく yes、anniversary 固定、年マークごとに1つ
- **他の callback タイプ**(週次語 callback、身体感覚類似、年次振り返り)─ Phase 0 後に延期

---

## ADR-018: プロダクト名を「いとなみ」から「ほしふみ」へ

**日付**: 2026-05-16
**ステータス**: 承認済み
**ADR-015 を上書き**(「いとなみ」という *choice* のみ。「みっつ」から離れる行為自体は依然有効)

### 背景
ADR-015 では「いとなみ」(営み = 日々の実践)を「みっつ」からのピボット(ADR-011)後に選択した。その時点ではプロダクトの世界観が言語化されていなかった ─ 名前は「日次5分の儀式」という *活動コンセプト* に合わせて選ばれた。

2026-05-16 のブレストで世界観が **「夜、ふとんから星を見上げるアプリ」** として結晶化:
- 過去エントリ = ユーザーの夜空に蓄積する星
- AI = 引用係 / 星座 pointer(ADR-016)
- callback = 古い星が今夜の空に再出現(ADR-017)
- Visual identity:warm 三日月 on deep indigo、身体感覚に月相(MoonPhase コンポーネント)
- 色 / フォント / アイコノグラフィー全部が warm cosmic-bedroom 像に収束

「いとなみ」は *活動*(「日常を営む」)を記述、雰囲気ではない。世界観が cosmic/atmospheric にシフトすると、名前と世界が match しなくなった。ブランドを holistic に読むと ─ 名前 + visual + コピー ─ disjoint が生じる:月夜のプロダクトを「daily practice」と呼んでいる。

### 検討した選択肢
世界観から派生する4軸で再ブレスト:
- **月**:みかづき、つきよ、つきあかり
- **星**:ほしふみ、ほしぞら、ほしあかり
- **夜**:よぞら、よばなし
- **灯**:ともしび、あかり

最終ショートリスト:
- **みかづき** ─ ロゴシンボルを直接名前にする、強いブランド cohesion
- **ほしふみ** ─ 造語:星(cosmic archive)+ ふみ(letter/writing)、両方の比喩を捕捉
- **ほしぞら** ─ 世界の直接描写
- **つきよ** ─ 古典的な mood-evoking

### 決定
**ほしふみ (hoshifumi)**。

- 表示ブランド:**ほしふみ**(ひらがな)
- ASCII ハンドル / package 名 / slug:**hoshifumi**
- リポジトリフォルダ名は `mittsu/` のまま ─ もう *2回* の改名 off(mittsu → itonami → hoshifumi)。物理フォルダリネームは引き続き延期。

### 根拠
- **両方のコア比喩を1語で捉える**:「星」(蓄積する cosmic archive = ユーザーの個人資産となる)+ 「ふみ」(letter / writing = ジャーナリングの行為)。両半分を捉える競合名なし
- **タグラインが自然に出る**:「寝る前の5分、星をふみに」 ─ 直接的、詩的、ブランドと一致
- **「ふみ」 に文学的品格**:やや古語、万葉集時代の 文 として認識可能。ジャーナリングを utility から craft に高める
- **4 モーラ、ASCII フレンドリー**、覚えやすい
- ブランドマーク(三日月)と名前(星 + 書く)が **interlock**:月は constant な夜、星はその中に来て去るエントリ

### 影響
- ユーザー向けコピー全部を変更:いとなみ → ほしふみ(CLAUDE.md, README, PRD, SPEC, ROADMAP, DEPLOYMENT, API-REFERENCE、複数 app ファイル)
- `package.json` の `name` フィールド:`itonami` → `hoshifumi`
- **タグライン更新**:「今日のいとなみに、5分だけ」 → **「寝る前の5分、星をふみに」**
- ADR-015 の "decision" セクションは上書き。残り(背景、検討した選択肢、改名理由、改名プロセスからの影響)は歴史的記録として有効
- フォルダ rename + ドメイン取得(hoshifumi.app / .jp / etc.)は引き続き延期
- **約2日で2回目の改名**(みっつ → いとなみ → ほしふみ)。Pre-PMF のイテレーション正常範囲、ただしフラグ:将来の改名は強い理由 + 理想的には `docs/WORLDVIEW.md` 起草後にすべき(名前と世界観が意識的に共進化するように、世界観に先んじて名前が走らない)

### 未解決の論点
- CLAUDE.md の worldview ノートを `docs/WORLDVIEW.md` に独立させ、将来の改名議論の参照点にするか。推奨
- ドメイン名(`hoshifumi.app` / `hoshifumi.jp` 等)─ v1.0 launch 準備まで延期

---

## ADR-019: プロダクト世界観 ─ 夜、ふとんから星を見上げるアプリ

**日付**: 2026-05-16
**ステータス**: 承認済み

### 背景
2026-05-14/16 のブレストを通じて、プロダクトは generic な「3問日次ジャーナル」(みっつ、ADR-011 以降上書き)から、よりシャープな atmospheric identity を持つものに進化した。オーナーのメンタルイメージ ─ **「横たわって星空を眺めている自分」** ─ がこのプロダクトの感触を表す正しい比喩として浮上した(対抗候補の「夜更けに机のスタンドだけ点いてる部屋」は production journaling ツールには合うが、このプロダクトの intent には合わない)。

ここまで、この世界観はいくつかの下流意思決定の **暗黙の基盤** として機能してきた:
- ADR-016(AI は引用係、解釈者ではない) ─ 「受動的、production ではない」 posture から派生
- ADR-017(γ-stage past-entry callback) ─ 「あなたの夜空に蓄積する星」から派生
- ADR-018(ほしふみへの改名) ─ 名前自体が世界観要素(星 + ふみ)を組み合わせる
- カラー移行(deep indigo 背景 + warm amber アクセント)
- タイポグラフィ選択(Zen Maru Gothic ─ 丸い、warm)
- ロゴデザイン(deep indigo 上の warm 三日月)
- システム絵文字削除と引き換えのカスタム SVG(MoonPhase コンポーネント、icon-mark.svg)
- streak コピーの softening(「○日連続」 → 「○つ灯った」)

しかし世界観自体は CLAUDE.md の brief な「Critical Architectural Decisions」ノートとしてしか記録されていなかった。この ADR は世界観を first-class なアーキテクチャ意思決定として形式化する。以降の設計問いがカノニカルな参照を持ち、将来の改名や redirection がこの基盤の明示的な reconsideration を要求するように。(2日で2回の改名が起きたのは、世界観の言語化が名前選択に遅れたから ─ この ADR がそのギャップを閉じる。)

### 検討した選択肢
同じブレストセッションの早い段階で、2つの競合するメンタルイメージがあった:
- **「夜更けに机のスタンドだけ点いてる部屋」**(Claude の最初のイメージ):机の writer、能動的、屋内、focused → production journaling(Day One, Notion)に合う。却下。
- **「夜、ふとんから星を見上げる自分」**(オーナーのイメージ):横たわってる、受動的、上向き、liminal → 実際のプロダクト intent(寄り添う、蓄積されて財産、AI as quoter 等)に合う。採用。

2つのイメージは3つの crucial 軸で異なる:posture(能動 vs 受動)、focus(手元 vs 外/上)、time-frame(現タスク vs liminal/atmospheric)。オーナーのイメージがこのプロダクトには3軸全部で勝った。

### 決定
**プロダクト世界観は「夜、ふとんから星を見上げるアプリ」**。

全 visual、コピー、motion、AI 挙動、プロダクト判断は、このイメージに照らして測られる。Litmus test:*「これは横たわってベッドで自身の蓄積する journaling 星空を見上げる人と一致するか?」*

### このイメージが INCLUDE するもの(yes-list)
- **受動的 posture** ─ 横たわっている、surrendered、能動的に produce していない
- **上向きの gaze** ─ 外向き / cosmic、ただし内向きに turn させる仕方で
- **包まれた安全 + 広大な開放** ─ ふとん(intimate, safe)が夜空(infinite)の中にある。両層が重要で互いを補強
- **蓄積する光の点** ─ 各エントリは時間とともに自分の constellation に加わる小さな warm point
- **デフォルトの沈黙** ─ 星は喋らない。アプリも喋らない、ユーザーを引用するとき以外は
- **時間が見える** ─ 月相が progress し、過去エントリが callback として戻り、アーカイブが個人の空になる
- **深い暗さの上の warm small アクセント** ─ soft で深い void の中の illuminated point
- **遅い / breathing pace** ─ fade と breath motion、slide や bounce じゃない

### このイメージが EXCLUDE するもの(no-list / anti-pattern)
- **Production / work verbs**(「送信する」「達成」「タスク」) → 「置く」「灯す」「眠る前に」を優先
- **Achievement / ゲーミフィケーションフレーミング**(「○日連続」強調、🔥 絵文字、streak punishment、バッジアンロック) → 「○つ灯った」に soften か完全削除
- **スコア、数値評価、ランキング、「performance」チャート**
- **明るいコントラスト / loud カラー** ─ saturated primary、純白背景、ネオンアクセント
- **鋭い / rigid forms** ─ 小さい border-radius、角張ったアイコン、硬い幾何形
- **Bouncy / slidey motion** ─ spring 物理、slide-in パネル、jump アニメ
- **侵入する AI コメント**(「あなたは〇〇な傾向です」) ─ ADR-016 参照
- **システム絵文字** ─ Apple/Google の visual world に属する、わたしたちのではない → カスタム SVG(MoonPhase、icon-mark.svg)
- **朝 / 日中の使用** を主フレーミングに ─ プロダクトは夜のために設計、日中は out of scope(延期、積極的拒絶ではない)

### 根拠
- **単一イメージの基盤は最も持続する**。Apple(「シンプル」)、Snap(「snap of a moment」)、Calm(「breathing」)。最強のプロダクトには全てを駆動する1つのイメージがある。それがないと下流の不整合をユーザーが言語化できなくても感じる(=「AI 感がある」「テック寄り」「生成された感じ」)
- **Atmospheric が activity に勝つ**。「ユーザーがアプリ使用中に何を感じるか」が「ユーザーが何をするか」より持続する。活動記述は古びる、雰囲気は古びない
- **選ばれたイメージは多層で成長余地あり**:enclosure(privacy)、上向き gaze(navel-gazing なしの内省)、星(蓄積/アーカイブ)、月(循環時間)、暗さ(休息/contemplation)。各層が他を上書きせずに発展可能
- **先行するプロダクト緊張を直接解決**:
  - 「ease vs depth」 → 星を見るのは restful だが深さを invite
  - 「streak vs no-pressure」 → 星は罰しない、ただ蓄積する
  - 「AI value vs ユーザー autonomy」 → AI は星座 pointer(namer ではない)、両方を保つ

### 影響
- **この ADR は基盤的** ─ ADR-013/016/017/018 と複数の小さな設計判断に対して。この世界観が再考されることがあれば、これらの ADR は下流整合性のために再評価必要
- **将来のプロダクト/設計判断は全部 ADR-019 を主要 measure として参照すべき**。便利な prompt:
  - 「これはふとんで横になって上を見上げる人にハマるか?」
  - 「これはユーザーに *向こうから来る* か、それともユーザーが seek することを期待するか?」
  - 「これは暗い空の中の warm small point として読めるか、それとも明るいインタフェース要素か?」
  - 「これはユーザーを引用してる(yes)か、ラベリングしてる(no)か?(ADR-016)」
- **独立した living doc `docs/WORLDVIEW.md`** を次に書くべき ─ operational specifics(hex コード、タイポ選択、コピー例、anti-pattern カタログ、スクショ付き)を elaborate する。ADR-019 が決定を固定、WORLDVIEW.md が日々の参照のために operationalize する
- **Anti-anti-pattern として警戒**:over-purify しないこと。必要な UI 要素が比喩に完全にハマらない場合(カレンダーグリッドのレイアウト、設定ページのフォームフィールド、エラーメッセージ)、比喩を torture するのではなく必要な妥協を受容。世界観は北極星であって檻ではない
- **ブランド進化**:将来の機能追加(日中モード、Web シェア、グループ機能等)は、この世界観に照らしてまず評価。新スコープが世界観の UPDATE(= 019 を上書きする新 ADR)を要求するかもしれない、世界を quietly 裏切る additive 機能ではなく

### 未解決の論点
- ~~**`docs/WORLDVIEW.md` の内容とタイミング**~~ **2026-05-16 解決**:`docs/WORLDVIEW.md` を作成、yes/no anti-pattern カタログ + 色 / タイポ / モーション / コピー基準を統合。CLAUDE.md の worldview ノートは要約 + WORLDVIEW.md への参照に簡素化。
- **日中 / 非就寝時使用**:現在の明示的スタンスは「out of scope」。利用研究で demand が見えたら、(a) 追加拒否、(b) 別モードとして明示的世界観考慮付き追加、(c) 日中レイヤーを含むよう世界観 update のいずれかを決定
- **アクセシビリティのエスケープバルブ**:高コントラストモード、photosensitivity のあるユーザー向け light モード preference 等 ─ 世界観の visual choice を legitimately オーバーライドする可能性。v1.0 launch 前に明確なエスケープバルブ原則必要
- **Light モードトグル**:世界観に従い v0/v1.0 では明示的に未対応。アクセシビリティ必要性が浮上した場合のみ再考

---

## ADR-020: HANDOFF.md を廃止し CLAUDE.md に集約

**日付**: 2026-05-17
**ステータス**: 承認済み

### 背景

`docs/HANDOFF.md` は「Claude Code セッション開始時に最初に読むファイル」として bootstrap-app-docs 13-doc セットの一部に含めていた。team handoff の比喩で書かれており、2026-05-16 時点の HANDOFF.md は以下のセクションで構成されていた:

- 現状 / 次にすべきこと(Phase 0 のステータス)
- 意思決定の哲学
- v0 で確立された設計パターン(Tailwind クラス文字列含む)
- よくある質問(Q&A)
- オーナーのプロフィール / コミュニケーションスタイル
- 探し物の場所(ナビ表)
- 編集してはいけないファイル

運用してみると、以下の重複・腐敗が露呈した:

- **CLAUDE.md が自動 inject される**ので「最初に読むファイル」は二段ロケットになっていた
- 「現状」セクションは週単位で腐る(NEXT-ACTIONS.md / git log が真実)
- オーナープロフィール / コミュニケーションスタイルは Claude memory に既に存在
- 設計パターンの Tailwind 文字列は DESIGN.md §4 により完全な形で存在(HANDOFF 側は劣化コピーになっていた)
- Q&A / 編集禁止 / 探し物表は実用性があるが、独立ファイルにする理由は薄い(CLAUDE.md 末尾でよい)

solo dev の現実では「team handoff」の比喩自体が contrived。

### 検討した選択肢

- **A: HANDOFF.md を残す**(セクションを刈り込みつつ独立ファイルを維持)
- **B: HANDOFF.md を削除し、ユニークな価値部分を CLAUDE.md へ移植**(本決定)
- **C: HANDOFF.md を残し、CLAUDE.md から「最初に HANDOFF を読め」と明示的にリンク**(現状運用、ただし二段ロケット)

### 決定

**B: HANDOFF.md を削除し、CLAUDE.md にユニーク部分を移植する。**

移植先と扱い:
- **Q&A / 編集禁止 / ナビ表** → `CLAUDE.md` 末尾に追加(英文 CLAUDE.md のスタイルに合わせて記述)
- **「現状」「次にすべきこと」** → 削除(NEXT-ACTIONS.md と git log が canonical)
- **「オーナーのプロフィール」「コミュニケーションスタイル」** → 削除(memory が canonical、二重管理を解消)
- **「設計パターンの Tailwind 文字列」** → 削除(DESIGN.md §4 が canonical、HANDOFF 版は劣化コピー)
- **「v0 で確立された設計パターン」のファイル配置・命名規則** → 削除(STRUCTURE.md / API-REFERENCE.md / CLAUDE.md 既存記述が canonical)

参照を更新するファイル:
- `docs/STRUCTURE.md`(3 箇所のリンク・言及)
- `docs/NEXT-ACTIONS.md`(2 箇所の言及)

### 根拠

- **CLAUDE.md は自動 inject される**:Claude Code セッションごとに必ず読まれる。HANDOFF.md は「自分で開く」必要があり、二段読み込みは摩擦
- **canonical source 単一化**:同じ情報が複数ファイルにあると、片方が腐ったときに気づきにくい(現に Tailwind 文字列は DESIGN.md と HANDOFF.md でズレていた)
- **solo dev に「引き継ぎ」は contrived**:HANDOFF の比喩はチーム前提。solo では「未来の自分への手紙」は CLAUDE.md で十分
- **腐敗するセクションを排除**:「現状」「次にすべきこと」は週次でステールになり、git log / NEXT-ACTIONS.md と乖離が出る

### 影響

- `docs/` の doc 数が 13 → 12 に減る(bootstrap-app-docs skill 由来のテンプレートとの乖離が発生)
- **bootstrap-app-docs skill template への反映が必要**:HANDOFF.md を template から外すか、「solo dev では不要」と注記して残すかを別途決定
- 「最初に読むファイル」が CLAUDE.md のみに一本化される(認知負荷低減)
- 移植先の CLAUDE.md が長くなる(現状 ~170 行 → 約 230 行)
- 過去 HANDOFF.md を参照していた外部リンク / メモは死ぬ(プロジェクト外参照は現状なしと想定)

### 未解決の論点

- ~~**bootstrap-app-docs skill template への反映方針**~~ **2026-05-17 解決**:案 A を採用し、`~/.claude/skills/bootstrap-app-docs/templates/HANDOFF.md` を完全削除、SKILL.md を 13 doc → 12 doc に改訂。「索引役は CLAUDE.md など auto-loaded doc に集約する」方針を skill 側の方法論にも明記。

---

## 新規 ADR のテンプレート

```markdown
## ADR-NNN: タイトル

**日付**: YYYY-MM-DD
**ステータス**: 提案中 | 承認済み | ADR-XXX により上書き

### 背景
解決したい問題は何か?どんな力が働いているか?

### 検討した選択肢
- 選択肢 A
- 選択肢 B
- 選択肢 C

### 決定
選んだもの。

### 根拠
なぜこの選択肢が勝ったか。

### 影響
これによって何にロックインされるか?何が防がれるか?
```

---

## ADR-021: Phase 1 の LLM provider に Gemini 2.0 Flash を採用、`lib/ai/` 抽象化層で差し替え可能に

**日付**: 2026-05-18
**ステータス**: 承認済み

### 背景

SPEC.md は現状、AI 用途のデフォルトモデルとして Claude Sonnet 4.6 / fallback に Claude Haiku 4.5 を指定している。Haiku 換算でも 1 user / 月 ~$0.005、1000 user / 月 ~$5 とコスト絶対値は小さいが、オーナーから「Phase 1(= v1.0 AI follow-up + 月次レポート、ADR-012 / ADR-016 関連)はそこまで高い精度を要らない。無料で日本語対応の LLM はどうか」と提起された。

Phase 1 の現実的な前提:

- Phase 0 セルフテスト + 早期 v1.0 β は **1 user 環境**(オーナー本人のみ)。コスト絶対値より、Anthropic API キー必須 + 使用量ダッシュボード監視という **運用負担** の方が大きい
- Phase 1 で AI を呼ぶのは 2 用途:**AI follow-up question**(Q1+Q2 → why 質問 1 回、~500 tokens)+ **月次レポート**(curation primitives、~2000 tokens)
- 両方とも ADR-016 引用係原則(要約しない / ラベリングしない / 解釈しない、引用と配置のみ)に準拠必須
- 求める精度:fluent JP + ADR-019 worldview 常体トーン + instruction following(構造化制約)。高度な creative writing は不要

本日 2026-05-18 のセッションで検討、`issues/2026-05-18-llm-provider-choice.md`(#002)に discussion 蓄積、issue + ADR 両方を起こすことに決定。

### 検討した選択肢

- **A: Claude Sonnet 4.6 / Haiku 4.5 を維持**(現 SPEC):精度最高、Anthropic SDK 整備済み、コストは規模時のみ問題
- **B: Gemini 2.0 Flash (Google) を採用**:無料枠 15 RPM / 1500 RPD / 1M TPM、JP 強い、instruction following 良好
- **C: Llama 3.3 70B (OpenRouter 経由 free)**:free tier 不安定、JP は二級
- **D: Qwen 2.5 / 3**:中華系、JP 学習はあるが Gemini ほど自然ではない
- **E: DeepSeek V3**:無料 API は寛大だが、JP 精度未実測

### 決定

**B: Gemini 2.0 Flash を Phase 1 の LLM provider として採用する。** SDK は `@google/genai` (TypeScript)。呼び出しは `lib/ai/` 抽象化層を一枚かませて行い、provider 差し替え時のコード変更を 1 ファイルに局所化する。v1.1+ のユーザースケール時に Claude Haiku 4.5 / Sonnet 4.6 への switch を再検討する。

新規ファイル構成:

- `lib/ai/index.ts` ─ provider 切替可能な `generate` 関数を export
- `lib/ai/providers/gemini.ts` ─ Phase 1 初期実装
- `lib/ai/providers/anthropic.ts` ─ 将来追加用の stub

### 根拠

- **無料枠が owner only 規模を桁違いに上回る**:15 RPM = 1 日 1500 回。owner = 1 日 1〜2 回 follow-up + 月 1 回 report で free tier の 0.1% も使わない。1500 user 規模まで無料持続見込み
- **JP 精度が十分**:Google の検索データ由来で JP コーパスが豊富、worldview の常体トーン「だね / だよ」追従可
- **ADR-016 引用係原則への compliance**:instruction following が割と素直で、Llama 系より明確に良い。prompt engineering + few-shot example でカバー可能と判断
- **switch cost が低い**:`lib/ai/` 抽象化により provider 差し替えは 1 ファイル変更で済む。prompt は LLM 共通仕様で再利用可能
- **タイミングが噛み合う**:v1.0 β 終了 → v1.1 で real user 流入が見えてから上位モデル検討で十分間に合う(無料枠で 1500 user まで持つので焦る必要なし)

### 影響

- **SPEC.md の AI セクション**:Phase 1 = Gemini 2.0 Flash と明記、v1.1+ で revisit する旨を注記(spec-keeper に dispatch 候補)
- **`.env.example`**:`ANTHROPIC_API_KEY` の隣に `GEMINI_API_KEY` を追加。ADR-012 着手時に切替
- **新規ファイル**:`lib/ai/index.ts` / `lib/ai/providers/gemini.ts` / `lib/ai/providers/anthropic.ts`(stub)
- **依存追加**:`@google/genai` を `package.json` に追加(ADR-012 実装着手時)
- **ADR-016 遵守の実測が必須**:ADR-012 着手の first task として、同 prompt を Claude Sonnet と Gemini Flash 両方に投げ、引用係原則違反率を比較
- **vendor lock-in の mitigation**:`lib/ai/` 抽象化により、Gemini free tier 縮小 or 精度劣化発覚時に低コストで provider switch 可能
- **`docs/AI-PROMPTS.md` 着手時の制約変更**:プロンプト template は LLM 中立で書く(`{{provider_specific}}` 等の hack は禁止)
- **issue 連動**:`issues/2026-05-18-llm-provider-choice.md`(#002)を本 ADR 紐づけで close

### 未解決の論点

- **Claude へ switch する閾値**(user 数?コスト絶対値?精度劣化観測?)─ v1.1 着手時に決める
- **月次レポート用に higher-quality model(Gemini 1.5 Pro 等)を使い分けるか**(follow-up は Flash、report は Pro で切替)─ ADR-016 月次スキーマ再設計時に決める
- **ADR-016 引用係原則の違反検出 / 自動テスト**(LLM 出力が summary / 診断っぽくなったときに reject する仕組み)─ 別 ADR 候補

---

## ADR-022: Phase 1 LLM provider を Gemini 2.0 Flash から Anthropic Claude Haiku 4.5 に切替(ADR-021 の provider 選定部分のみ上書き)

**日付**: 2026-05-19
**ステータス**: 承認済み(ADR-021 の **Phase 1 provider 選定部分のみ partial supersede**。`lib/ai/` 抽象化方針 / provider 差し替え可能性 / v1.1+ 再評価方針は ADR-021 のまま継続)

### 背景

ADR-021(2026-05-18)で Phase 1 LLM provider を Gemini 2.0 Flash に決定、`lib/ai/` 抽象化層と `gemini.ts` / `anthropic.ts` (stub) を構築した。翌 2026-05-18 〜 19 の smoke test で Gemini API が即エラー:

```
Quota exceeded for metric: generate_content_free_tier_requests, limit: 0
```

`limit: 0`(= free tier 割当ゼロ)。billing 未設定でも本来は free tier に割り当てがあるはずだが、owner の GCP project は project type / region / 過去履歴の何らかの理由で 0 割当てになっていた。Phase 0 セルフテストが止まる状況で、対処オプションを 3 つ検討した。

`issues/2026-05-19-gemini-free-tier-zero.md` に discussion 蓄積、ADR-021 を partial supersede する形で本 ADR を起こす。

### 検討した選択肢

- **A: Gemini billing を有効化(paid tier 切替)** ─ カード登録 5 分、月 $0.005(~0.75 円)、ADR-021 をそのまま継続できる。確実に動く
- **B: 新 AI Studio project を作って free tier 再取得を試す** ─ 無料維持の可能性はあるが、成功保証なし。fragile な解決策で時間コスト高
- **C: Anthropic Claude Haiku 4.5 に切替**(本決定) ─ `ANTHROPIC_API_KEY` は initial setup から既に残っている、billing 設定不要、`lib/ai/providers/anthropic.ts` stub を実体化するだけで即動作。月 ~$0.05(~7.5 円)

### 決定

**C: Anthropic Claude Haiku 4.5 を Phase 1(owner test + 早期 β、~100 user 規模まで)の LLM provider として採用する。** ADR-021 で構築した `lib/ai/` 抽象化はそのまま活用、env `AI_PROVIDER=anthropic` で切替えるだけでコードレベルの仕様変更は発生しない(default 値は ADR-021 通り `gemini` のまま維持)。Gemini billing 解決 or β 後 100+ user 規模到達時に Gemini への switch back を再評価する。

具体作業:

- `lib/ai/providers/anthropic.ts` を stub → 実装(`@anthropic-ai/sdk` 0.95.2、既 install)。role mapping(`"model"` → `"assistant"`)、AbortController、APIError handling を含む
- `.env.example` に `AI_PROVIDER=anthropic` への切替コメント追加
- `.env.local` に `AI_PROVIDER=anthropic` 追加(`ANTHROPIC_API_KEY` は既存)
- Vercel 本番 env に `ANTHROPIC_API_KEY` + `AI_PROVIDER=anthropic` 設定(deploy 前必須)
- model: `claude-haiku-4-5`(alias、dated form は `claude-haiku-4-5-20251001`)

### 根拠

- **即動作で Phase 0 / Phase 1 検証が止まらない**:`ANTHROPIC_API_KEY` が initial setup から残っており、billing 設定や project 作り直しが不要。Gemini billing 解決や新 project 取得を待たずに 5 分で復旧できる
- **コストは owner 規模で許容**:月 ~$0.05(7.5 円)、Gemini 月 ~$0.005 との差は ~6 円/月で誤差。100 user で $5(750 円)、1000 user で $50(7500 円)─ 1000 user 規模で初めて Gemini 切替が経済合理性を持つ
- **JP 精度 + ADR-016 引用係原則の instruction following**:Claude は instruction following が SOTA 水準で、引用係原則(要約・診断・アドバイス禁止)の遵守度が Gemini Flash より高いと判断。Anthropic の system prompt 解釈精度の評判通り
- **ADR-021 の抽象化がここで真価を発揮**:`lib/ai/` 抽象化のおかげでコード差は `anthropic.ts` 1 file の stub → 実装のみ。ADR-021 の方針自体は完全に正しく、今回はその上で provider 選定だけを差し替える形になる
- **CLAUDE.md の fallback model 記載と整合**:Claude Haiku 4.5 は元々 CLAUDE.md で fallback model として明示されていた。運用ノウハウの累積もある

### 影響

- **ADR-021 の partial supersede 関係**:Phase 1 LLM provider 選定の部分のみ本 ADR で上書き。**`lib/ai/` 抽象化方針 / provider 差し替え可能性 / v1.1+ 再評価方針 / vendor lock-in mitigation 思想は ADR-021 のまま継続**。ADR-021 本文は append-only 規律により touch しない
- **`lib/ai/providers/anthropic.ts`**:stub → 実装(role mapping、AbortController、APIError handling)
- **`.env.example`**:`AI_PROVIDER=anthropic` への切替コメント追記
- **`.env.local`**:owner が `AI_PROVIDER=anthropic` を追加(`ANTHROPIC_API_KEY` 既存)
- **Vercel 本番 env**:`ANTHROPIC_API_KEY` + `AI_PROVIDER=anthropic` を deploy 前に設定必須
- **SPEC.md AI セクション**:Gemini 言及を Anthropic 主体 + Gemini はバックアップ option に書き換え(spec-keeper に別途 dispatch)
- **コスト試算 update**:owner $0.05/月、100 user $5/月、1000 user $50/月。1000 user 規模で Gemini 切替が経済合理性を持つ
- **ADR-021 default 値との不一致**:`lib/ai/` の default は `gemini` のまま、env で override して運用。コードを触らずに切戻し可能(ADR-021 の抽象化が機能する形)

### 未解決の論点

- **Gemini billing 解決時の switch back タイミング**(β 直前?Phase 0 完了後?即時?)
- **100+ user 到達時の A/B 評価方法**(同 prompt で両 model に投げて引用係原則遵守度を比較?サンプル数?)
- **Claude Haiku 4.5 が Anthropic で deprecated になった時の next model**(Sonnet にスケールアップ? Haiku 5 待ち?)

---

## ADR-023: Q3 を「自由記述 closure」から「chip + text escape ハイブリッド」へ再変更(ADR-014 の input_type 部分のみ partial supersede)

- **Date**: 2026-05-19
- **Status**: Accepted
- **Supersedes**: ADR-014(partial ─ Q3 input_type 部分のみ上書き。「ユーザー自身の言葉が活きる」hope は本 ADR の text escape path で部分継承するため、完全 revert ではない)
- **Resolves**: ─
- **Related spec**: `docs/specs/2026-05-19-q3-hybrid-chip-design.md`(本 ADR と parallel に spec-keeper が作成中)

### 背景

ADR-014(2026-05-14)で Q3 を v0 当時の 5 択 chip(「がんばれ / ゆっくりしよう / 今日はOK / 昨日のままで / なにか変えたい」)から自由記述(「明日の自分にひとことだけ」)に変更した。理由は二つあった:(1)「ユーザー自身の言葉のほうが closure として活きる」という hope、(2)「AI 深掘りの後にチップに戻ると jarring(認知的な落差)」という予測。

その後 2026-05-18 に ADR-012 通り AI follow-up question を実装、Q2 と Q3 の間に AI 質問 step が成立した。3 問構造は **Q1(身体感覚 tap)→ Q2(今日の出来事 free text)→ AI follow-up(なぜそう感じた)→ Q3(明日への closure)** という flow に整った。

ところが 2026-05-19 の Phase 0 Day 2、owner 自身の自己使用観察で次のことが明らかになった:

- **Q3 free text が「明日もがんばろう」化**:ADR-014 が hope した「深い closure」になっておらず、実質 chip と同じ役割に collapse(毎日同じような短文を free text で書いている)
- **「chip だと jarring」予測も実質非問題化**:user 自身が chip 相当のものを毎日 free text で書いているため、jarring の前提(「深い言葉に続く chip の落差」)が成立していない
- **AI step が「深い探索」を担うようになった構造変化**:Q3 の役割は「軽い ritual closure」として再定義可能になった
- **Q3 free text の認知負荷(「何を書こう」)が closure 軽快さに逆らう**:寝る前の 5 分の儀式の最後で「考えさせる」のは worldview(夜、ふとんから星を見上げる)とも整合しない

これらを踏まえ、Q3 input_type の再変更を決定する。

### 検討した選択肢

- **A: ADR-014 のまま free text 維持** ─ 現状維持。ただし owner 観察で「重い、毎日同じ」摩擦が確認されており、放置は worldview 違反を続けることになる
- **B: 削除(Q3 なし、AI follow-up で submit 完了)** ─ ritual rhythm(3 問構造の終わりの確かさ)を喪失。structural にも risky(就寝前の「終わり感」が立たない)
- **C: pure chip 復活(ADR-014 完全 revert)** ─ escape valve がなく、「今日は特別なことがあった」日への対応が失われる。ADR-014 の hope を完全に捨てることになる
- **D: chip + text escape ハイブリッド**(本決定) ─ default は 1 tap の軽快 closure、必要な日は text escape で柔軟性継承

### 決定

**D: hybrid chip + text escape を採用。**

具体仕様:

- input_type 新規追加:`chip_with_text`
- default = 4 chip(`明日もがんばる` / `ゆっくり眠る` / `今日はここまで` / `そのままで`)
- 「自由に書く」link で textarea expand(escape valve)、復帰 link あり
- storage:chip 選択 = `value_choice` 保存、escape text 入力 = `value_text` 保存、**排他**(両方同時保存はしない)
- DB schema は既存維持(`value_choice` + `value_text` 両 column 既存・両 nullable)、migration 不要

ADR-014 で行った「`value_choice` → `value_text` への移行」は **partial revert**:`free_text` 必須は revert(chip path 復活)、しかし ADR-014 の「ユーザー自身の言葉」hope は escape text path として温存する。完全な revert ではない。

### 根拠

- **実 user 行動への adaptation**:ADR-014 の hope は owner 観察で外れた事実が確認できた。closure を「user 言葉の深さ」要求から「軽い ritual signal」に再定義する(YAGNI 適用 ─ hope した深さが実現してないなら、それを強制する構造を保つ理由はない)
- **AI step の役割分担明確化**:AI follow-up が「深い探索」を担う構造で、Q3 は「軽い closure」が役割分担として natural。Q2(出来事)→ AI(なぜ)→ Q3(明日へ)の階層が、free text 三連よりも認知 rhythm として自然
- **柔軟性を捨てない**:chip default + text escape で「特別な日」への対応継承、ADR-014 の hope を部分救済する。chip しか選べないと特別な日への対応を失う、free text 必須だと毎日の認知負荷を強制する、その両方を回避する
- **DB 互換**:`value_choice` + `value_text` を排他で使う、両 column 既存・両 nullable、migration 不要。実装コストが低い
- **chip text の worldview 適合**:「明日もがんばる」「ゆっくり眠る」「今日はここまで」「そのままで」の 4 chip は全て ADR-019 worldview の YES list(穏やか、受容、上向き)と整合し、ADR-008(罰しない / プレッシャーかけない)も尊重している
- **Pre-PMF / Phase 0 の段階特性**:owner 自身が user である pre-PMF 段階では、観察 → 即 ADR → 反映の cycle を回す価値がある。ADR-014 を 5 日で再考することは規律違反ではなく、append-only な記録の上で transparent に supersede する正道

### 影響

- **ADR-014 partial supersede**:Q3 input_type 部分のみ上書き、「user 言葉が活きる」hope は escape text path で部分継承(完全 revert ではない、と明示)。ADR-014 本文は append-only 規律により touch しない
- **`lib/constants/template.ts`** BASIC_TEMPLATE Q3 改修:input_type → `chip_with_text`、options array に 4 chip 追加
- **`lib/types.ts`** InputType union 拡張:`"chip_with_text"` を追加
- **新規 component**:`app/today/_components/ChipWithTextEscape.tsx`(chip 配列 + 「自由に書く」link + textarea expand state)
- **`QuestionFlow.tsx`** Q3 step rendering 分岐、state(`tomorrowChip` + `tomorrowMessage` の排他管理)
- **`submitEntry`** input + answers insert 分岐(chip path / text path)
- **`/calendar/[date]` EntryDetail** Q3 display 分岐(chip-like visual / text visual)
- **DB schema**:変更なし、`value_choice` + `value_text` 両既存・両 nullable で受ける
- **既存 entries 互換**:ADR-014 期(2026-05-14 〜 2026-05-19)の free text entries は display で text path、migration 不要
- **`docs/SPEC.md`** Q3 section update(別 spec-keeper dispatch、ADR-023 / spec doc 確定後に)
- **Pencil design system**(`/design/hoshifumi.pen`):chip component の追加が望ましい(別タスク、本 ADR scope 外)

### 未解決の論点

- **chip text の長期的進化**:Phase 0 終了時の owner 観察で「もっとこの chip 欲しい / この chip 使わなかった」が出たら追加 / 入替の運用をどうするか(その都度 ADR? 軽量な改定 log?)
- **chip text の user customization**:v1.1+ で検討(現状 hard-coded、custom template 機能と一緒に動かす)
- **既存 ADR-014 期 entries の display 一貫性**:text のみ entries が chip 化 entries と混在する月の体感、長期観察対象(/calendar の月次 view で違和感が出るか)
- **mode 切替時の animation 詳細**:chip → textarea expand 時、textarea → chip 復帰時の transition(spec §9 で open、実装時に確定)

