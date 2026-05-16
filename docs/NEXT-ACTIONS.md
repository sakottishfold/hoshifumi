# Next Actions

> 今やる / 次やる / 検討する を一箇所にまとめた living TODO。
> ADR の未解決の論点 + ROADMAP の must-have + HANDOFF / SPEC / PRD の open items を統合。
> 各項目に **出典** を併記、詳細は元 doc を参照。
> Last updated: 2026-05-16

---

## 🌒 今:Phase 0(オーナーの30日セルフテスト)

開始前の準備と、テスト中に並行で進めるもの。

- [ ] **Vercel デプロイ** ─ `DEPLOYMENT.md` Step 2
- [ ] **Supabase 本番プロジェクト作成 + 初期 migration** ─ `DEPLOYMENT.md` Step 1
- [ ] **メール配信設定** ─ Resend 推奨、当面 Supabase 標準でも可 ─ `DEPLOYMENT.md` §1.5
- [ ] **iOS Safari にホーム追加してリマインダーセット** ─ `DEPLOYMENT.md` Step 5, 7
- [ ] **30日連続使用** ─ `ROADMAP.md` Phase 0 / `PRD.md` §7
- [ ] **`FRICTION-LOG.md` に毎日記録** ─ 違和感は全部書く、修正は後回し

判断:Phase 0 成功(21日以上連続)→ v1.0 着手 / 失敗 → 摩擦分析 → 修正 → リスタート

---

## 🌓 次:v1.0 着手時(Phase 0 成功後)

Phase 0 終了して、β に向けた本格実装。

### コア機能(Must-have)
- [ ] **AI follow-up question** 実装 ─ `ADR-012` / `SPEC.md` §3
- [ ] **DB スキーマ migration** ─ 1ファイルにまとめて:
  - `answers.question_position` CHECK を 1..3 → 1..5(or 削除)
  - `answers.question_text` 列追加(nullable、AI 生成質問用)
  - `profiles.last_callback_at` / `profiles.unlocked_stage` 追加(callback state)
  - 出典:`ADR-012`, `ADR-017`, `SPEC.md` §2 §8
- [ ] **Past-entry callback** 実装 ─ `ADR-017` / `SPEC.md` §8
  - `selectCallbackEntry()` Server Action(未着手、DB migration とセット)
  - ~~callback カード UI コンポーネント~~ **2026-05-16 完了**:`components/CallbackCard.tsx`、未統合(SA 待ち)
- [ ] **追加テンプレート**(仕事 / 親 / クリエイター系) ─ `ROADMAP.md` v1.0
- [ ] **テンプレ選択 onboarding** ─ `ROADMAP.md` v1.0
- [ ] **月次 AI レポート** 生成 ─ `SPEC.md` §9
  - **⚠️ 出力スキーマを ADR-016 準拠で再設計してから実装**(現プロンプトの `summary_text` は引用係原則違反)
- [ ] **月次レポート閲覧ページ** ─ `ROADMAP.md` v1.0
- [ ] **検索**(基本テキスト) ─ `ROADMAP.md` v1.0
- [ ] **オンボーディング**(Welcome → テンプレ選択 → 最初のエントリ)
- [ ] **プライバシーポリシー / 利用規約** ページ ─ `PRD.md` §8

### Nice-to-have
- [ ] エントリの template_name 編集
- [ ] Streak "休みの日"(1日スキップでリセットしない)
- [ ] JSON / Markdown エクスポート

---

## 🌗 意思決定が必要(decide → 実装可能)

設計を進めるために決めないといけない論点。実装のブロッカーになる。

### プロダクト戦略
- [ ] **Free vs Pro 境界線**(AI 1日1回を Free に入れるか、Pro 限定か) ─ `ADR-012` open
- [ ] **Pro 無料トライアル期間**(7日 / 14日 / なし) ─ `SPEC.md` §15
- [ ] **年額ディスカウント**(12ヶ月で10ヶ月分?) ─ `SPEC.md` §15
- [ ] **解約フロー**(ソフト確認 + win-back?) ─ `SPEC.md` §15

### v1.0 仕様詳細
- [ ] **AI follow-up プロンプト草案**(ADR-016 引用係原則を embed) ─ `ADR-012` open
- [ ] **AI follow-up Single vs Multi-turn**(まず single-turn 推奨) ─ `ADR-012` open
- [ ] **AI follow-up 失敗時 fallback**(silent skip / retry / Q3 にジャンプ) ─ `ADR-012` open
- [ ] **Custom template UI**(v1.1 前にモックアップ必要) ─ `SPEC.md` §15
- [ ] **Push 通知 opt-in タイミング**(Day 3 / 初回完了 / その他) ─ `SPEC.md` §15
- [ ] **callback カードの視覚デザイン** ─ `ADR-017` open
- [ ] **callback エッジケース**:
  - [ ] 範囲内エントリがない時のフォールバック挙動(現状:silent skip)
  - [ ] 過去エントリ編集後の再表示ポリシー
  - [ ] 「この日は見たくない」 opt-out 粒度
  - 出典:`ADR-017` open
- [ ] **Year 2+ anniversary 挙動**(2年前・3年前のスタック?)─ `ADR-017` open
- [ ] **月次レポート出力スキーマ再設計**(ADR-016 違反箇所を curation primitive に置換) ─ `ADR-016` consequences

### 世界観 / アクセシビリティ
- [ ] **日中 / 非就寝時使用** の明示スタンス(現状 out of scope) ─ `ADR-019` open
- [ ] **アクセシビリティエスケープバルブ**(high-contrast / light mode preference 等) ─ `ADR-019` open / v1.0 launch 前必須
- [ ] **AI への「最近の自分」質問の edge ケース**(引用係原則を破らない応答設計) ─ `ADR-016` open

---

## 🌕 後でやる / Backlog

優先度低、ただし忘れない用。

### インフラ・運用
- [x] ~~**物理フォルダ rename**:`mittsu/` → `hoshifumi/`~~ **2026-05-16 完了** ─ `ADR-018`(memory dir も同時に rename、docs 内のパス参照も更新済み)
- [ ] **ドメイン取得**:`hoshifumi.app` / `hoshifumi.jp` 等 ─ v1.0 launch 前 ─ `ADR-018` open
- [ ] **フォント self-host 最適化**(現状 Google Fonts CDN、PWA offline 対応で要検討)
- [ ] **CRON_SECRET の設定**(v1.1 月次レポート Cron 用) ─ `DEPLOYMENT.md` Step 6

### v1.1+ 機能
- [ ] **Stripe 統合**(Free/Pro/Premium) ─ `ROADMAP.md` v1.1
- [ ] **カスタムテンプレ作成**(Pro 機能) ─ `ROADMAP.md` v1.1
- [ ] **Web Push 通知**(PWA) ─ `ROADMAP.md` v1.1
- [ ] **Obsidian エクスポート**(Premium) ─ `ROADMAP.md` v1.1
- [ ] **似てる体感の日 callback**(身体感覚軸の callback) ─ `ADR-017` future / `SPEC.md` §8
- [ ] **週次語 callback**(今週よく出てきた言葉) ─ `ADR-017` future
- [ ] **年次振り返り(Year-in-review)** ─ `ROADMAP.md` v1.1 / `ADR-017` future

### v1.2+
- [ ] **音声入力**(Web Speech API + Whisper fallback) ─ `ROADMAP.md` v1.2
- [ ] **写真添付**(親テンプレ向け) ─ `ROADMAP.md` v1.2
- [ ] **AI 質問の進化**(3週間後に新質問提案) ─ `ROADMAP.md` v1.2
- [ ] **マルチターン AI 対話**(v1.0 の single follow-up を超えた深いやり取り、Premium) ─ `ROADMAP.md` v2.0

### 品質・改善
- [ ] **Vitest / Playwright 導入**(v1.1 launch 前 happy-path E2E) ─ `HANDOFF.md`
- [ ] **WORLDVIEW.md にスクショ付き anti-pattern 例追加**(具体例で yes/no の判断が早くなる)
- [ ] **月相 SVG phase 3 の半月を更に磨く**(現状で許容範囲、精度上げる場合はベクター調整)
- [ ] **Error tracking 導入**(Sentry or Vercel) ─ `DEPLOYMENT.md` 本番チェックリスト
- [ ] **アナリティクス導入**(Plausible / Vercel Analytics) ─ `DEPLOYMENT.md` 本番チェックリスト

### Doc 補完(壁打ち済み、未着手)
- [ ] **`docs/AI-PROMPTS.md`** ─ AI follow-up / 月次レポート プロンプトカタログ(ADR-012 着手時に必須、ADR-016 準拠チェックの枠組み込み)
- [ ] **`docs/COPY.md`** ─ マイクロコピー集(画面 × 状態の approved copy 一覧、WORLDVIEW のトーン原則を具体化)
- [x] ~~**`docs/MOTION.md`**(または WORLDVIEW.md 拡張)─ 秒数・easing curve まで具体化したモーション仕様~~ **2026-05-16 完了** ─ `docs/MOTION.md` 作成、WORLDVIEW.md Motion セクションは要点のみに短縮 + MOTION.md への link 化
- [ ] **`docs/COMPONENTS.md`** ─ コンポーネントカタログ(現状コンポーネント数少ないので急がない、15個超えてから)
- [ ] **`docs/USER-FLOW.md`** ─ 画面遷移マップ(v1.0 で onboarding 等が増えてから)

### Pencil でのデザイン作業(`docs/PENCIL.md` 参照)
- [ ] **`design/hoshifumi.pen`** 作成、`set_variables` で DESIGN.md のトークンを流し込む(初期セットアップ)
- [ ] **`screen-today-done` + callback カードのモック**(ADR-017 open question を解く起点)
- [ ] **`flow-daily-ritual`** ─ AI follow-up 込みの全フロー俯瞰(ADR-012 着手前)

---

## 更新ルール

- **完了したら** ~~取り消し線~~ + 完了日を併記。1〜2セッション残して、その後削除して履歴を ADR に逃がす
- **新規 NA が出たら** 適切なフェーズセクションに追加(出典 doc / ADR 番号を併記)
- **大物の論点**(複数 ADR や複数機能に影響するもの)が出たら、新規 ADR を立てて open question を移動 → 本 NA リストはその ADR を参照
- **このファイルは canonical source**:他 doc(ROADMAP / HANDOFF / 各 ADR の open questions)が更新されたら、本 NA も同期する
