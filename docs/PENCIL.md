# PENCIL.md ─ Pencil でビジュアルデザインを作るときのプレイブック

> Pencil(MCP `mcp__pencil__*` ツール群)で `.pen` ファイルでビジュアルデザインを作るときの、ほしふみ専用ガイドライン。
> Pencil は "web/mobile app の design generator / validator" として位置づけられた MCP ツール、`.pen` 拡張子のキャンバスファイルを編集する。
> 最終更新: 2026-05-16

---

## なぜ Pencil を使うか

コードだけだと欠ける視点があるから:

- **画面全体の俯瞰**:1ページずつ実装してると "アプリ全体の見え方" が見えない
- **既存と新規の比較**:複数案を並べて比べたいとき、コードだと面倒
- **ユーザーが見るデザインの先行検討**:実装前にビジュアルで「これ世界観合ってる?」を測りたい
- **コンポーネント variant の網羅**:Button や Card の全 state を1枚で見たい
- **コミュニケーション素材**:オーナー以外(将来の協力者・β ユーザー)に見せるとき
- **MCP 経由で AI(Claude)がデザインを作れる**:壁打ちの結果をビジュアルに落とせる

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
| `screen-` | `screen-today`、`screen-today-done`、`screen-calendar` | 既存または計画中の画面 |
| `flow-` | `flow-onboarding`、`flow-daily-ritual` | 複数画面にまたがるユーザージャーニー |
| `component-` | `component-callback-card`、`component-buttons` | コンポーネント単体・variants |
| `idea-` | `idea-callback-glow` | まだ採用してない試案、破棄候補 |
| `archive-` | `archive-mittsu-v0` | 過去案、参考用に保存 |

### Git 管理

- `.pen` ファイルは encrypted バイナリ ─ git diff で意味は読めない
- が、**コミットする**:バージョン履歴と「いつデザインが変わったか」が分かるように
- 大きな変更はコミットメッセージに概要(「callback card デザイン3案追加」等)
- `.gitignore` に **入れない**(意思決定の履歴として残す価値)

---

## ワークフロー

### 1. 開始前

毎回最初に:

```
1. mcp__pencil__get_editor_state(include_schema: true)
   → 現在の編集状態と .pen スキーマを取得
2. mcp__pencil__get_guidelines()
   → 利用可能な guides / styles のリスト
3. mcp__pencil__get_guidelines(category: "guide", name: "Mobile App")
   → モバイルアプリのレイアウト原則を読む(必須)
4. mcp__pencil__get_guidelines(category: "guide", name: "Design System")
   → コンポーネント slot の使い方(コンポーネント挿入する場合)
```

ファイルがなければ `mcp__pencil__open_document("new")` で新規作成。既存なら `open_document(path)`。

### 2. デザイン token の流し込み(初回のみ)

`set_variables` で `docs/DESIGN.md` §2 の color、§3 の typography を Pencil 変数として登録する:

```
mcp__pencil__set_variables で:
  --background:      oklch(12% 0.04 280)
  --foreground:      oklch(94% 0.02 75)
  --muted-foreground: oklch(67% 0.025 75)
  --card:            oklch(18% 0.04 280)
  --border:          oklch(32% 0.03 280)
  --primary:         oklch(83% 0.10 80)
  --primary-foreground: oklch(18% 0.04 280)
  --font-primary:    "Zen Maru Gothic"
  --font-secondary:  "Zen Maru Gothic"
  --radius-m:        16
  --radius-pill:     9999
```

これで以降の `batch_design` で `$--primary` 等のトークン参照が機能する。

### 3. screen / component 作成

Mobile App guide の structure(Status Bar 62px / App Content / 必要なら Tab Bar)に従う。

ただし **ほしふみは bottom Tab Bar を持たない**(現状)─ 全画面が単一フロー型なので。代わりに上部 AppHeader が固定。

```
mcp__pencil__batch_design で:
  screen=I(document, {type: "frame", name: "screen-today",
    layout: "vertical", width: 393, height: "fit_content(852)",
    fill: "$--background"})
  
  statusBar=I(screen, {height: 62, ...})  // OS chrome
  
  header=I(screen, {height: 56, ...})     // AppHeader 相当
    icon=I(header, {type: "icon_font", iconFontFamily: "lucide",
      iconFontName: "moon", width: 20, height: 20, fill: "$--primary"})
    brand=I(header, {type: "text", content: "ほしふみ", ...})
  
  content=I(screen, {layout: "vertical", padding: 24, gap: 32,
    width: "fill_container"})
    title=I(content, {type: "text", content: "今夜のほしふみ、はじめよう", ...})
    // ... 主コンテンツ
```

### 4. 検証

```
1. mcp__pencil__get_screenshot
   → 出来上がりを画像で確認
2. WORLDVIEW.md の yes/no list と照らす
3. DESIGN.md §7 Don't list に違反してないか確認
4. 必要なら batch_design で修正
```

### 5. 書き出し(必要なら)

```
mcp__pencil__export_nodes
  → PNG / SVG で書き出してドキュメントに埋め込む
```

書き出した画像は `design/exports/{date}-{topic}.png` 等に置く。

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
  iconFontName: "dark_mode", width: 40, height: 40, fill: "$--primary"})
```

**方法 B**:SVG 画像として読み込み
- `public/icon-mark.svg` を `mcp__pencil__image` 操作で挿入
- 静止画用途なら最も brand-faithful

### コピーは WORLDVIEW を参照

プレースホルダーテキストを入れるときも `WORLDVIEW.md` のコピーパターンに従う:
- ❌ "Submit"、"OK" → ✅ 「置く」「はじめよう」「眠る前に」
- ❌ "Welcome back!" → ✅ 「おかえり。今夜も。」
- ❌ "3-day streak!" → ✅ 「3つ、灯った」

### 世界観チェック(Pencil 完成後)

毎回 export 前に以下を見直す:

- [ ] 背景は deep indigo(`$--background` ≒ #0a0a1a)
- [ ] 純白・純黒 / saturated ネオン / 派手 contrast を使ってない
- [ ] フォントは Zen Maru Gothic 系(Hiragino Maru でも可)
- [ ] 角丸は `radius-m`(16px)以上
- [ ] システム絵文字(🔥 ☀ 🌧 等)を直貼りしてない
- [ ] CTA 配置・コピー・密度が DESIGN.md §4 のパターンと一致
- [ ] AI 関連要素は ADR-016 引用係原則準拠(diagnosis テキストなし等)

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
