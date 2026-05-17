# PENCIL.md ─ Pencil でビジュアルデザインを作るときのプレイブック

> Pencil(`pencil` CLI)で `.pen` ファイルにビジュアルデザインを作るときの、ほしふみ専用ガイドライン。
> Pencil は web/mobile app 向け design generator / validator、`.pen` 拡張子のキャンバスファイルを編集する。**実行は CLI 経由のみ、MCP `mcp__pencil__*` は使わない**(理由は §ワークフロー)。
> 最終更新: 2026-05-17

---

## なぜ Pencil を使うか

コードだけだと欠ける視点があるから:

- **画面全体の俯瞰**:1ページずつ実装してると "アプリ全体の見え方" が見えない
- **既存と新規の比較**:複数案を並べて比べたいとき、コードだと面倒
- **ユーザーが見るデザインの先行検討**:実装前にビジュアルで「これ世界観合ってる?」を測りたい
- **コンポーネント variant の網羅**:Button や Card の全 state を1枚で見たい
- **コミュニケーション素材**:オーナー以外(将来の協力者・β ユーザー)に見せるとき
- **`pencil` CLI 経由で AI(Claude / Pencil 内蔵 AI)がデザインを作れる**:壁打ちの結果をビジュアルに落とせる

---

## 何を Pencil で作るか

| 対象 | 理由 |
|---|---|
| **新規画面モックアップ**(コード書く前)| 世界観に照らした事前検証 |
| **既存画面の改修案**(複数バリエーション) | 比較しやすい、戻れる |
| **AI follow-up step の UX 試作**(未実装) | ADR-012 着手前のビジュアル要件詰め |
| **Past-entry callback カードのデザイン**(ADR-017 open question) | カードの形 / コピー配置 / モーション静止画 |
| **追加テンプレートのスクリーンモック**(v1.0) | テンプレ追加の判断材料 |
| **新規コンポーネントの spec シート**(Card variants 全部とか) | 実装前のレビュー資料 |
| **オンボーディング・LP の構成案**(v1.1) | 1画面ずつコードで作る前に俯瞰 |

## 何を Pencil で **作らない** か

| 対象 | 理由 |
|---|---|
| Production component | コードが canonical(`components/`、`app/` の中) |
| マイクロコピー集 | `docs/COPY.md`(将来書く)で markdown 管理 |
| カラートークン / typography 定義 | `app/globals.css` + `docs/DESIGN.md` が canonical |
| アニメーション spec | 静止画では表現できない、`docs/MOTION.md`(将来)で |
| 確定済みの UI(現状動いているもの)| 既にコードにあるので Pencil 化は時間の無駄 |

**原則**:Pencil は **意思決定の前** に使う。決まった後はコードが真実。

---

## ファイル運用

### 場所と命名

- 場所:`design/` ディレクトリ(プロジェクトルート直下)に `.pen` ファイルを置く
- メインファイル:`design/hoshifumi.pen` ─ 全画面・コンポーネントを1つの .pen に集約
- 必要に応じてサブファイル:
  - `design/exploration-{topic}.pen` ─ 試作・破棄候補
  - `design/components.pen` ─ コンポーネント variants の網羅(成熟したら)

### ページ命名(.pen 内の page 単位)

| プレフィックス | 例 | 用途 |
|---|---|---|
| `screen-flow` | screen frames(以下のフレーム命名規則参照)を集める | 既存または計画中の画面 |
| `component-library` | コンポーネント単体・variants を集める | 再利用部品 |
| `flow-{name}` | `flow-onboarding`、`flow-daily-ritual` | 複数画面にまたがるユーザージャーニー |
| `idea-{topic}` | `idea-callback-glow` | まだ採用してない試案、破棄候補 |
| `archive-{label}` | `archive-mittsu-v0` | 過去案、参考用に保存 |

### フレーム命名(`.pen` 内の screen / variant 単位)

**パターン**: `{screen}_{state}`(セパレータは `_` のみ、`screen-` プレフィックス禁止)

- `screen` 部: kebab-case(例:`today`、`today-done`、`calendar-detail`)
- `state` 部: kebab-case か単語(例:`initial`、`sent`、`q1`、`with-callback`、`no-callback`、`empty`、`default`)
- **単一状態の画面でも `_default` を付ける**(統一感維持、後の variant 追加が楽)

ほしふみの確定マッピング:

| 旧名 | 新名 |
|---|---|
| `screen-login`(初期表示)| `login_initial` |
| `screen-login-sent`(メール送信後)| `login_sent` |
| `screen-today-q1` | `today_q1` |
| `screen-today-q2` | `today_q2` |
| `screen-today-q3` | `today_q3` |
| `screen-today-done-callback` | `today-done_with-callback` |
| `screen-today-done-nocallback` | `today-done_no-callback` |
| `screen-calendar` | `calendar_with-entries` |
| `screen-calendar-empty` | `calendar_empty` |
| `screen-calendar-detail` | `calendar-detail_default` |
| `screen-settings` | `settings_default` |

### フレーム配置規律

`.pen` 内でフレームを並べるときの原則:

- **オーバーラップ禁止**:必ず空白を挟む
- **一定間隔**:水平・垂直とも **100px** ギャップ(`--frame-gap` トークンで定義、配置時に必ず参照)
- **配置順**:左から右 / 上から下に「ユーザーが画面を歩く順序」で並べる
  1. `login_initial` → `login_sent`
  2. `today_q1` → `today_q2` → `today_q3`
  3. `today-done_with-callback` / `today-done_no-callback`(同じ列に並べる)
  4. `calendar_with-entries` / `calendar_empty`(同じ列)
  5. `calendar-detail_default`
  6. `settings_default`
- 並びそのものが見えるジャーニーマップになる

### Git 管理

- `.pen` ファイルは encrypted バイナリ ─ git diff で意味は読めない
- が、**コミットする**:バージョン履歴と「いつデザインが変わったか」が分かるように
- 大きな変更はコミットメッセージに概要(「callback card デザイン3案追加」等)
- `.gitignore` に **入れない**(意思決定の履歴として残す価値)

---

## ワークフロー

> Pencil は **CLI 経由のみ** 使う(MCP `mcp__pencil__*` は不使用)。詳細は `~/.claude/skills/designing-with-pencil/SKILL.md` 参照。

### 1. 起動

```bash
# 動作中の Pencil app に接続(現在 in-memory の state を引き継ぐ、Cmd+S 不要)
pencil interactive --app desktop --in design/hoshifumi.pen

# またはヘッドレス(disk のみで完結、終わりに save() 必須)
pencil interactive --out design/hoshifumi.pen --in design/hoshifumi.pen

# 新規ファイルなら --in を省く
pencil interactive --out design/hoshifumi.pen
```

interactive shell に入ったら、毎回最初に:

```
pencil > get_editor_state({ include_schema: true })
pencil > get_guidelines()
pencil > get_guidelines({ category: "guide", name: "Mobile App" })
pencil > get_guidelines({ category: "guide", name: "Design System" })
```

batch / 高水準命令で済むなら interactive を経由せず直接:

```bash
# JSON tasks で batch(再現性高い)
pencil --in design/hoshifumi.pen --out design/hoshifumi.pen --tasks scripts/pencil-tasks.json

# Pencil 自身の AI に高水準意図を渡す
pencil --in design/hoshifumi.pen --out design/hoshifumi.pen --prompt "..."
```

### 2. デザイントークンの網羅的流し込み(初回のみ)

色だけで終わらせない。DESIGN.md にある **全カテゴリの reusable token** を `set_variables` で投入。ad-hoc 値を `batch_design` リテラルで書くのは禁止。

Pencil 制約: カラーは **hex のみ**(OKLCH 不可、DESIGN.md からの hex 近似を使う)。`fontFamily` はリテラル文字列(`$` 変数バインド不可)。

ほしふみで定義する完全リスト:

```
// カラー(DESIGN.md §2、OKLCH → hex 近似)
--bg-body:           #0a0a1a  // oklch(12% 0.04 280)
--bg-neutral-50:     #15152a  // oklch(18% 0.04 280)、elevated card / input
--bg-neutral-100:    #1d1d36  // oklch(24% 0.04 280)、hover
--bg-primary-50:     #1f1d18  // oklch(22% 0.03 75)、highlighted card
--border-neutral-200: #46455a // oklch(32% 0.03 280)
--border-primary-100: #4a3f2a // oklch(30% 0.05 75)
--text-neutral-900:  #f4eddc  // oklch(94% 0.02 75)、本文
--text-neutral-800:  #e8e0cd  // oklch(89% 0.02 75)、本文 strong
--text-neutral-700:  #d8cdb8  // oklch(83% 0.02 75)、secondary
--text-neutral-600:  #c4b9a4  // oklch(76% 0.02 75)、補助
--text-neutral-500:  #a99e89  // oklch(67% 0.025 75)、labels
--text-neutral-400:  #8b8273  // oklch(55% 0.025 75)、tertiary muted
--primary-500:       #f0d4a0  // oklch(83% 0.10 80)、CTA bg / 月色
--primary-600:       #c79c5e  // oklch(73% 0.12 75)、hover / 強調テキスト
--primary-700:       #f0c98a  // oklch(85% 0.13 75)、アクセントテキスト

// タイポグラフィ サイズ(DESIGN.md §3、Tailwind 準拠)
--font-xs:   12
--font-sm:   14
--font-base: 16
--font-lg:   18
--font-xl:   20
--font-2xl:  24
--font-3xl:  30
--font-4xl:  36

// 角丸(DESIGN.md §5)
--radius-xl:   12  // 入力 / 小ボタン
--radius-2xl:  16  // カード / 大ボタン
--radius-full: 9999  // チップ / アイコンボタン

// スペーシング(DESIGN.md §5、Tailwind ベース)
--space-2: 8
--space-3: 12
--space-4: 16
--space-6: 24
--space-8: 32

// レイアウト定数
--page-max-width: 448  // max-w-md
--page-px:        24   // ページ wrapper の左右 padding

// フレーム配置(本 doc 規律)
--frame-gap: 100  // .pen 内のフレーム間隔(水平・垂直とも)

// フォントは文字列リテラル(変数バインド不可、参考に残す)
--font-primary:    "Zen Maru Gothic"  // 実使用時は fontFamily: "Zen Maru Gothic" を直書き
```

これで以降の `batch_design` で `$primary-500` 等のトークン参照が機能する。

途中で「このサイズも token 化したい」が出てきたら、その時点で `set_variables` を再呼び出して追加してから使う ─ ad-hoc 値で「とりあえず」を残さない。

### 3. screen / component 作成

Mobile App guide の structure(Status Bar 62px / App Content / 必要なら Tab Bar)に従う。

ただし **ほしふみは bottom Tab Bar を持たない**(現状)─ 全画面が単一フロー型なので。代わりに上部 AppHeader が固定。

```
pencil > batch_design({operations: `
  screen=I(document, {type: "frame", name: "today_q1",
    layout: "vertical", width: 393, height: "fit_content(852)",
    fill: "$bg-body"})

  header=I(screen, {height: 56, ...})     // AppHeader 相当
    icon=I(header, {type: "image", source: "public/icon-mark.svg",
      width: 20, height: 20})
    brand=I(header, {type: "text", content: "ほしふみ", ...})

  content=I(screen, {layout: "vertical", padding: "$page-px", gap: "$space-8",
    width: "fill_container"})
    title=I(content, {type: "text", content: "今夜のほしふみ、はじめよう", ...})
    // ... 主コンテンツ
`})
```

### 4. 検証

```
pencil > get_screenshot()
# → 出来上がりを画像で確認
```

その後:
1. WORLDVIEW.md の yes/no list と照らす
2. DESIGN.md §7 Don't list に違反してないか確認
3. 必要なら `batch_design` で修正

### 5. 書き出し(必要なら)

```
pencil > export_nodes({ ... })
# → PNG / SVG で書き出してドキュメントに埋め込む

# 終わったら明示的に保存
pencil > save()
```

書き出した画像は `design/exports/{date}-{topic}.png` 等に置く。`save()` 忘れ防止のため、interactive 終了前にチェック。

---

## 既知の落とし穴(実証ベース、2026-05-17)

### Token swap は `batch_design` の `U()` で(`replace_all_matching_properties` は NG)

`replace_all_matching_properties` で `$old-token` → `$new-token` を一括 swap しようとすると、**variable binding ではなく literal string `"$new-token"` として書き込まれる** ─ ref が壊れて色が消える。

正しい手順:
- `batch_design` の `U()` (update) で 1 ノードずつ `fillColor: {type: "ref", ref: "new-token"}` を明示的に書く
- 100+ ノード swap は **phase 分割**:(a) `set_variables` で新 token 追加 → (b) component を順次 rebind → (c) screen を順次 rebind → (d) 旧 token 削除
- `pencil --prompt` モードは内部 AI(Claude Opus)が tool loop で動くため、大規模 sweep には遅い / コスト高(2026-05-17 に 70分超え事例、`replace_all_matching_properties` 採用ミスで agent stuck)
- 機械的な batch 操作には **`pencil --tasks <tasks.json>`** が候補(本リポジトリでは未検証、要実証)

ただし hex 値が **既に一致する** 旧→新ペアは `replace_all_matching_properties` でも literal swap で正解になることがある(literal hex `#15152a` を別の literal hex `#15152a` に置換するだけなので無害)。`set_variables` 経由の token ref を切り替えたいなら必ず `batch_design U()`。

### Pencil CLI と app の disk 同期

- Pencil app が動作中だと in-memory state が disk と乖離 → CLI で disk を書き換えても app は気付かない、後で app 側 Cmd+S すると CLI の結果を上書きする
- CLI 操作前に **Pencil app を閉じる** か、`pencil interactive --app desktop` で app に接続して in-memory state を引き継いで作業
- headless `pencil interactive --out --in` 系は必ず明示的 `save()` で disk 書き込み、忘れると変更が消える

---

## 推奨スタイル / 推奨しないスタイル

Pencil には built-in style が27個あるが、**ほしふみの世界観に完全に合うものはない**。

| スタイル名 | 距離感 | 採否 |
|---|---|---|
| `Dark Centered Platform` | dark theme で近い | 参考になるが too tech / too platform-y |
| `Cinematic Alternating` | 映画的、雰囲気重視 | カラーリングは違うが構成は学べる |
| `Editorial Scientific` | clean、literary | 知性寄り、warm さに欠ける |
| その他大半 | landing page / marketing 系 | 用途違い |

**結論**:built-in style は使わず、`set_variables` で **自前のトークン**を流し込んで使う。DESIGN.md §2 の color / §3 の typography が正本。

---

## ほしふみ固有の Pencil 活用ヒント

### 月相アイコンを再現する

`components/MoonPhase.tsx` 相当は Pencil に native でない。再現方法:

**方法 A**:既成アイコン
- `Material Symbols Rounded` の `dark_mode`(三日月)を amber 色で挿入
- phase ごとの厳密な月相は再現できない、近似で OK
```
moon=I(container, {type: "icon_font", iconFontFamily: "Material Symbols Rounded",
  iconFontName: "dark_mode", width: 40, height: 40, fill: "$primary-500"})
```

**方法 B**:SVG 画像として読み込み
- `public/icon-mark.svg` を `image` 操作で挿入(interactive shell or batch_design 内)
- 静止画用途なら最も brand-faithful

### コピーは WORLDVIEW を参照

プレースホルダーテキストを入れるときも `WORLDVIEW.md` のコピーパターンに従う:
- ❌ "Submit"、"OK" → ✅ 「置く」「はじめよう」「眠る前に」
- ❌ "Welcome back!" → ✅ 「おかえり。今夜も。」
- ❌ "3-day streak!" → ✅ 「3つ、灯った」

### 世界観チェック + 規律チェック(Pencil 完成後)

毎回 export 前に以下を見直す:

**世界観:**
- [ ] 背景は deep indigo(`$--bg-body` = `#0a0a1a`)
- [ ] 純白・純黒 / saturated ネオン / 派手 contrast を使ってない
- [ ] フォントは Zen Maru Gothic 系(Hiragino Maru でも可)
- [ ] 角丸は `--radius-xl`(12px)以上
- [ ] システム絵文字(🔥 ☀ 🌧 等)を直貼りしてない
- [ ] CTA 配置・コピー・密度が DESIGN.md §4 のパターンと一致
- [ ] AI 関連要素は ADR-016 引用係原則準拠(diagnosis テキストなし等)

**トークン・フレーム規律:**
- [ ] 全色 / 全 size / 全 radius / 全 spacing がトークン参照、ad-hoc 値ゼロ
- [ ] フレーム名が **`{screen}_{state}` パターン**(上記マッピング)に合致
- [ ] フレーム同士が重なってない、`--frame-gap`(100px)で並んでる
- [ ] フレーム並び順がユーザージャーニー順

---

## .pen ↔ code 同期方針

| 状態 | 真実は | アクション |
|---|---|---|
| 新規 idea を Pencil で検討中 | Pencil | コード化前に decision を ADR or 議論で固める |
| Pencil で承認 → コード実装 | コード(以降)| .pen は archive- プレフィックスで参考保存 |
| コード ↔ Pencil で乖離発見 | コード | .pen を update して同期(コードを真とする) |
| コードでは未実装の機能のデザイン検討 | Pencil | 実装まで Pencil が "spec" の役割 |

**ルール**:既に動いているコードを変えるときは Pencil で先に検討、その後コード変更。
**逆方向**(コード先・Pencil 後)は避ける ─ Pencil の古い状態が「現状の表現」と誤読される。

---

## いま着手するなら何から?

優先度感(NEXT-ACTIONS.md と整合):

1. **🌒 今すぐ価値ある**:`screen-today-done`(callback カード含む)─ ADR-017 の open question「callback card 視覚デザイン」を解く
2. **🌓 次に**:`flow-daily-ritual`(Q1 → Q2 → AI follow-up → Q3 → done)─ ADR-012 着手前の俯瞰
3. **🌓 次に**:`component-buttons` / `component-cards` ─ 既存 variant を1枚にまとめる(将来の参照用)
4. **🌗 検討中になったら**:追加テンプレ(仕事 / 親 / クリエイター)の screen variant ─ どんな差分があれば「別テンプレ感」が出るか試す

---

## 参考リンク

- DESIGN.md(色・タイポ・コンポーネントトークン)
- WORLDVIEW.md(yes/no、anti-pattern)
- DECISIONS.md ADR-016, 017, 019
- 公式:Stitch DESIGN.md format ─ https://stitch.withgoogle.com/docs/design-md/format/
- 公式:awesome-design-md ─ https://github.com/VoltAgent/awesome-design-md
