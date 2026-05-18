# ネクストアクション

> 今やる / 次やる / 検討する を一箇所にまとめた living TODO。
> ADR の未解決の論点 + ROADMAP の must-have + SPEC / PRD の open items を統合。
> 各項目に **出典** を併記、詳細は元 doc を参照。
> 戦術レベル(ad-hoc バグ / 小機能要望 / 質問) は `issues/` に積む(`issues/README.md` 参照)。
> 最終更新: 2026-05-17

---

## 🌒 今:Phase 0(オーナーの30日セルフテスト)

開始前の準備と、テスト中に並行で進めるもの。

### Phase 0 着手前の最小実装(v1.0 から pull forward)
ADR-019 世界観「星が積もる」を Phase 0 で実機検証するため、callback だけ v1.0 から前倒し。

- [x] ~~**Past-entry callback 最小実装(Phase 0 scope: Stage 1-4 / deterministic unlock)**~~ **2026-05-17 完了**
  - migration: `supabase/migrations/20260517000000_callback_state.sql`(callback state + ADR-012 forward-compat 同梱)
  - Server Action: `lib/server-actions/callback.ts`(γ stage モデル、cool-down 3日 / 確率 35%)
  - util: `lib/utils/entry.ts`(`extractBodyPhase` / `extractFreeText`)
  - 統合: `app/today/done/page.tsx` ─ streak と calendar Link の間に CallbackCard
  - 出典: `ADR-017` / `SPEC.md` §8
- [ ] **ローカル動作確認** ─ `scripts/seed-callback.sql` で過去4エントリ投入 → 5本目 submit → Stage 1 deterministic 発火を確認(off-by-one バグ炙り出し)
- [x] ~~**Star Bloom on /today/done 実装**~~ **2026-05-18 完了** ─ ヒーロー月相を今日の Q1 phase に置換、bloom + glow + milestone burst(5/15/25/35/100/365)演出。α 厳格(no slide/bounce)、`prefers-reduced-motion` で全 anim 無効。spec: `docs/specs/2026-05-18-star-bloom-on-done-design.md`、plan: `docs/plans/2026-05-18-star-bloom-on-done.md`

### デプロイ
- [x] ~~**Supabase 本番プロジェクト作成 + 初期 migration**~~ **2026-05-17 完了** ─ `uytlmbhkxtgdvazhvjxy.supabase.co`、東京リージョン、migration 2 ファイル適用済み
- [x] ~~**Vercel デプロイ**~~ **2026-05-17 完了** ─ `https://hoshifumi.vercel.app`、Deployment Protection 解除済み、env 5 件投入
- [x] ~~**メール配信設定**~~ **2026-05-17 Google OAuth 採用で迂回** ─ Supabase デフォルト rate limit(2/h)が Phase 0 ですら使い物にならず、Resend ドメイン未取得のため Google OAuth を主動線に。Magic Link は backup として残存。Resend + 独自ドメインは v1.0 launch 前に着手(ADR 化候補)
- [x] ~~**iOS Safari にホーム追加**~~ **2026-05-17 完了** ─ ホーム画面に 🌒 アイコン追加、standalone モードで起動可能
- [ ] **iOS カレンダーで 22:00 毎日リマインダー設定**(`DEPLOYMENT.md` Step 7)
- [ ] **本番で Day 1 エントリ submit + FRICTION-LOG.md 初回記録**

### Phase 0 本番(30日)
- [ ] **30日連続使用** ─ `ROADMAP.md` Phase 0 / `PRD.md` §7
- [ ] **`FRICTION-LOG.md` に毎日記録** ─ 違和感は全部書く、修正は後回し
  - 特に観察すべき: callback の trigger タイミング(unlock 発火 / refire)、表示エントリの選ばれ方の体感、リロード時に消える挙動が「ふと出てくる」と整合するか

判断:Phase 0 成功(21日以上連続)→ v1.0 着手 / 失敗 → 摩擦分析 → 修正 → リスタート

---

## 🌓 次:v1.0 着手時(Phase 0 成功後)

Phase 0 終了して、β に向けた本格実装。

### コア機能(必須)
- [x] ~~**AI follow-up question** 実装~~ **2026-05-18 完了** ─ Gemini 2.0 Flash (ADR-021)、quote-back style (ADR-016)、blocking await + silent skip fallback。`lib/ai/` 抽象化基盤も同 spec で整備。spec: `docs/specs/2026-05-18-ai-followup-question-design.md`、plan: `docs/plans/2026-05-18-ai-followup-question.md`
- [x] ~~**DB スキーマ migration**~~ **2026-05-17 完了** ─ `supabase/migrations/20260517000000_callback_state.sql`:
  - ~~`answers.question_position` CHECK を 1..3 → 1..5~~ ← 1..5 に緩和
  - ~~`answers.question_text` 列追加~~ ← 追加(Phase 0 未使用、ADR-012 forward-compat)
  - ~~`profiles.last_callback_at` / `profiles.unlocked_stage` 追加~~ ← 追加
- [ ] **Past-entry callback v1.0 本実装** ─ Phase 0 scope は完了(🌒 セクション参照)。v1.0 で追加するもの:
  - ~~`selectCallbackEntry()` Server Action 基盤~~ **2026-05-17 完了**(Phase 0 scope)
  - ~~callback カード UI コンポーネント~~ **2026-05-16 完了**:`components/CallbackCard.tsx`
  - ~~done page 統合~~ **2026-05-17 完了**:`app/today/done/page.tsx` + `lib/utils/entry.ts`
  - [ ] Stage 5+(ひと季節前など)と anniversary(1年前)実装
  - [ ] window-probabilistic unlock への切り戻し検討(Phase 0 FRICTION-LOG 入力次第、現状は Phase 0 用に deterministic 化)
  - [ ] 似てる体感の日 callback(身体感覚軸)─ `ADR-017` future
  - 出典: `ADR-017` / `SPEC.md` §8
- [ ] **追加テンプレート**(仕事 / 親 / クリエイター系) ─ `ROADMAP.md` v1.0
- [ ] **テンプレ選択 onboarding** ─ `ROADMAP.md` v1.0
- [ ] **月次 AI レポート** 生成 ─ `SPEC.md` §9
  - **⚠️ 出力スキーマを ADR-016 準拠で再設計してから実装**(現プロンプトの `summary_text` は引用係原則違反)
- [ ] **月次レポート閲覧ページ** ─ `ROADMAP.md` v1.0
- [ ] **検索**(基本テキスト) ─ `ROADMAP.md` v1.0
- [ ] **オンボーディング**(Welcome → テンプレ選択 → 最初のエントリ)
- [ ] **プライバシーポリシー / 利用規約** ページ ─ `PRD.md` §8

### あると嬉しい
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
- [ ] **callback カードの視覚デザイン** ─ `ADR-017` open(現状 `bg-primary-50 border-primary-100` 暫定、Phase 0 FRICTION-LOG 観察を待ってから磨く)
- [ ] **callback エッジケース**:
  - [x] ~~範囲内エントリがない時のフォールバック挙動~~ **2026-05-17 実装決定**: silent skip(`last_callback_at` も更新せず翌日リトライ可)
  - [x] ~~unlock 発火日に該当 range の Q2 が全空~~ **2026-05-17 実装決定**: `unlocked_stage` を bump せず `null`、後日 back-fill で再発火可
  - [ ] 過去エントリ編集後の再表示ポリシー
  - [ ] 「この日は見たくない」 opt-out 粒度
  - [ ] `/today/done` リロードで callback が消える挙動の是非(現状: cool-down で re-roll 失敗 → 消える。Phase 0 で体感確認)
  - 出典:`ADR-017` open
- [ ] **Year 2+ anniversary 挙動**(2年前・3年前のスタック?)─ `ADR-017` open
- [ ] **月次レポート出力スキーマ再設計**(ADR-016 違反箇所を curation primitive に置換) ─ `ADR-016` consequences

### 世界観 / アクセシビリティ
- [ ] **日中 / 非就寝時使用** の明示スタンス(現状 out of scope) ─ `ADR-019` open
- [ ] **アクセシビリティエスケープバルブ**(high-contrast / light mode preference 等) ─ `ADR-019` open / v1.0 launch 前必須
- [ ] **AI への「最近の自分」質問の edge ケース**(引用係原則を破らない応答設計) ─ `ADR-016` open

---

## 🌕 後でやる / バックログ

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
- [ ] **Vitest / Playwright 導入**(v1.1 launch 前 happy-path E2E) ─ `CLAUDE.md` Q&A「Add tests?」
- [ ] **WORLDVIEW.md にスクショ付き anti-pattern 例追加**(具体例で yes/no の判断が早くなる)
- [ ] **月相 SVG phase 3 の半月を更に磨く**(現状で許容範囲、精度上げる場合はベクター調整)
- [ ] **Error tracking 導入**(Sentry or Vercel) ─ `DEPLOYMENT.md` 本番チェックリスト
- [ ] **アナリティクス導入**(Plausible / Vercel Analytics) ─ `DEPLOYMENT.md` 本番チェックリスト

### ドキュメント補完(壁打ち済み、未着手)
- [ ] **`docs/AI-PROMPTS.md`** ─ AI follow-up / 月次レポート プロンプトカタログ(ADR-012 着手時に必須、ADR-016 準拠チェックの枠組み込み)
- [ ] **`docs/COPY.md`** ─ マイクロコピー集(画面 × 状態の approved copy 一覧、WORLDVIEW のトーン原則を具体化)
- [x] ~~**`docs/MOTION.md`**(または WORLDVIEW.md 拡張)─ 秒数・easing curve まで具体化したモーション仕様~~ **2026-05-16 完了** ─ `docs/MOTION.md` 作成、WORLDVIEW.md Motion セクションは要点のみに短縮 + MOTION.md への link 化
- [ ] **`docs/COMPONENTS.md`** ─ コンポーネントカタログ(現状コンポーネント数少ないので急がない、15個超えてから)
- [ ] **`docs/USER-FLOW.md`** ─ 画面遷移マップ(v1.0 で onboarding 等が増えてから)

### Pencil でのデザイン作業(`docs/PENCIL.md` 参照)
- [x] ~~**`design/hoshifumi.pen`** 作成、`set_variables` で DESIGN.md のトークンを流し込む(初期セットアップ)~~ **2026-05-17 完了**
- [x] ~~**`screen-today-done` + callback カードのモック**(ADR-017 open question を解く起点)~~ **2026-05-17 完了**(Phase 1 で `today-done_with-callback` / `today-done_no-callback` の2 variant 作成)
- [x] ~~**Phase 1 whole-app design**~~ **2026-05-17 完了** ─ 29 components + 11 screens、`design/exports/2026-05-17-phase1-v2.png`
- [ ] **トークン新旧並存の cleanup**(部分完了、残作業あり) ─ Phase 1 brush-up で旧命名と新命名が並存。2026-05-17 に 3 token(`body-bg` / `neutral-50` / `neutral-100`)削除 + 42 swap 完了、残りは hex 不一致のため未着手。**正しいアプローチ**:`batch_design` の `U()` で `fillColor: {type: "ref", ref: "..."}` を 1 ノードずつ書く + phase 分割(set_variables 追加 → components rebind → screens rebind → 旧削除)。`replace_all_matching_properties` は variable binding swap には使えない(literal string 化される、検証済み)。`pencil --prompt` モードでの大規模 sweep は 30分超えるので避ける、`pencil --tasks json` 経路(未検証)か手動 phase 分割を推奨。Phase 2 着手前に片付ける。出典:`docs/PENCIL.md`「既知の落とし穴」
- [ ] **`flow-daily-ritual`** ─ AI follow-up 込みの全フロー俯瞰(ADR-012 着手前、Phase 2)
- [ ] **Phase 2 ─ 未実装画面**(Onboarding / AI follow-up / 月次レポート) ─ AI 系仕様(ADR-012 / ADR-016 月次スキーマ)固まり次第着手

---

## 更新ルール

- **完了したら** ~~取り消し線~~ + 完了日を併記。1〜2セッション残して、その後削除して履歴を ADR に逃がす
- **新規 NA が出たら** 適切なフェーズセクションに追加(出典 doc / ADR 番号を併記)
- **大物の論点**(複数 ADR や複数機能に影響するもの)が出たら、新規 ADR を立てて open question を移動 → 本 NA リストはその ADR を参照
- **このファイルは canonical source**:他 doc(ROADMAP / 各 ADR の open questions)が更新されたら、本 NA も同期する
