# DESIGN.md ─ ほしふみ デザインシステム

> Google Stitch DESIGN.md フォーマット準拠の9セクション構成。
> **AI コーディングエージェントが UI 生成時に読む単一参照ファイル**。
> 関連 doc:
> - 哲学・なぜ:`docs/WORLDVIEW.md`(narrative, yes/no list の出典)
> - 実装トークンの canonical 値:`app/globals.css`(@theme ブロック)
> - 決定の履歴:`docs/DECISIONS.md`(ADR-016, 017, 019)
>
> 最終更新: 2026-05-16

---

## 1. ビジュアルテーマと雰囲気

**コアイメージ**:夜、ふとんから星を見上げるアプリ。

ユーザーは布団にくるまった受動的姿勢で、上を向いて自身の蓄積する journaling 星空を眺めている。アプリはその夜空であり、過去エントリは星として蓄積し、AI は星座を指差す存在(命名しない)。

**ムード**:
- 深く、温かく、静か
- 寝る前の liminal な時間
- 受容的、能動的・production 的ではない
- 個々は小さく、全体は大きい(点と暗闇のスケール対比)

**雰囲気キーワード**:dim / warm / quiet / spacious / contemplative / cosmic / intimate

**避けるべき雰囲気**:bright / loud / hurried / busy / sharp / cold / clinical / "tech"

---

## 2. カラーパレットと役割

すべての色は `app/globals.css` の `@theme` で **OKLCH** 定義、Tailwind トークンとして利用。pure white / pure black は **使わない**(神聖な対比は warm cream と deep indigo で作る)。

### 背景(深い夜の階層)

| トークン | OKLCH | Hex 近似 | 役割 |
|---|---|---|---|
| `body` background | `oklch(12% 0.04 280)` | `#0a0a1a` | ページ全体の void、最も深い夜 |
| `bg-neutral-50` | `oklch(18% 0.04 280)` | `#15152a` | カード / 入力 / elevated surface |
| `bg-neutral-100` | `oklch(24% 0.04 280)` | `#1d1d36` | hover state |
| `bg-primary-50` | `oklch(22% 0.03 75)` | `#1f1d18` | 強調されたカード(amber-tinted dark) |

### 境界線 / 区切り

| トークン | OKLCH | 役割 |
|---|---|---|
| `border-neutral-200` | `oklch(32% 0.03 280)` | カード境界・dividers |
| `border-primary-100` | `oklch(30% 0.05 75)` | 強調カードの境界 |

### テキスト(月光のような warm off-white 階層)

| トークン | OKLCH | 役割 |
|---|---|---|
| `text-neutral-900` | `oklch(94% 0.02 75)` | 本文・headings(primary) |
| `text-neutral-800` | `oklch(89% 0.02 75)` | 本文 strong |
| `text-neutral-700` | `oklch(83% 0.02 75)` | 本文・secondary |
| `text-neutral-600` | `oklch(76% 0.02 75)` | secondary 補助文 |
| `text-neutral-500` | `oklch(67% 0.025 75)` | labels / captions |
| `text-neutral-400` | `oklch(55% 0.025 75)` | tertiary muted |

### アクセント ─ Amber(月の色)

| トークン | OKLCH | Hex 近似 | 役割 |
|---|---|---|---|
| `bg-primary-500` | `oklch(83% 0.10 80)` | `#f0d4a0` | CTA filled bg / brand 月色 |
| `bg-primary-600` | `oklch(73% 0.12 75)` | `#c79c5e` | CTA hover state |
| `text-primary-600` | `oklch(73% 0.12 75)` | `#c79c5e` | 強調テキスト(streak数字等) |
| `text-primary-700` | `oklch(85% 0.13 75)` | `#f0c98a` | アクセントテキスト on dark |

### セカンダリアクセント ─ Lavender(補助、控えめ)

| トークン | OKLCH | 役割 |
|---|---|---|
| `color-accent-500` | `oklch(70% 0.15 290)` | 補助強調(現状は未使用、将来用に予約) |

### セマンティック(エラー等、最小限)

| トークン | 値 | 役割 |
|---|---|---|
| `text-red-600` | Tailwind デフォルト | error メッセージ |
| `text-red-500` | Tailwind デフォルト | カレンダーの日曜 |
| `text-blue-500` | Tailwind デフォルト | カレンダーの土曜 |

> ⚠️ 純白 `#ffffff` と純黒 `#000000` は使わない。`bg-white` `text-white` クラスも components で禁止(過去にも一度全置換した)。

---

## 3. タイポグラフィのルール

### フォントスタック

```
"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN W4",
"Yu Gothic Medium", "YuGothic", -apple-system, BlinkMacSystemFont, sans-serif
```

- **Primary**:Zen Maru Gothic(Google Fonts、weights 400/500/700 ロード)─ warm rounded gothic、ジャーナリングの literary 感
- **Fallback**:Hiragino Maru Gothic ProN(Mac/iOS native、丸ゴ)
- **絶対回避**:Sans-serif の標準(Inter / Helvetica 系)─ tech・clinical 感が出る
- **試して却下**:明朝系 ─ 「期待値通りすぎ」で温度が出ない

### タイプスケール(Tailwind デフォルト準拠)

| サイズ | Tailwind クラス | 用途 |
|---|---|---|
| 12px | `text-xs` | 補助 labels、taglines |
| 14px | `text-sm` | secondary 本文、ボタン small |
| 16px | `text-base` | 本文、ボタン |
| 18px | `text-lg` | 強調本文 |
| 20px | `text-xl` | サブヘッダー、AppHeader ロゴテキスト |
| 24px | `text-2xl` | screen タイトル(h1) |
| 30px | `text-3xl` | login の主見出し |
| 36px | `text-4xl` | 詳細画面のヘッダー、大型ラベル |
| 48px | `text-5xl` | ヒーロー(現状なし) |
| 60px | `text-6xl` | 大型シンボル(現状なし、過去 done 画面で使用) |

### ウェイトのルール

- `font-bold`(700):見出し、ボタンラベル、emphasized inline
- `font-medium`(500):強調(captions など)
- `font-normal`(400):本文(デフォルト)
- ※ Zen Maru Gothic は 400 と 500 と 700 をロードしてある。それ以外の中間 weight は使わない

### 行高

- 本文:`leading-relaxed`(1.625)─ 読みやすさ + 寝る前の余裕
- 見出し:`leading-tight`(1.25)
- 単一行ラベル:`leading-none`

---

## 4. コンポーネントスタイル

### ボタン

**Primary CTA**(月色 + 暗い indigo テキスト)
```
className: "rounded-xl bg-primary-500 px-4 py-3 text-base font-medium text-neutral-50 shadow-sm transition hover:bg-primary-600 disabled:opacity-50"
```
- 用途:ログイン、保存、つぎへ
- 1画面に1つ原則

**Secondary**(elevated dark bg + warm text)
```
className: "rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
```
- 用途:キャンセル、戻る、「これまでのほしふみを見る」

**Ghost / inline**(borderless、テキストのみ)
- Tailwind クラスなし、文字色 `text-neutral-500` でリンクとして配置

### カード

**Standard card**
```
className: "rounded-2xl bg-neutral-50 border border-neutral-200 p-5"
```

**Highlighted card**(streak / callback 等)
```
className: "rounded-2xl bg-primary-50 border border-primary-100 p-6"
```

**Empty state card**
```
className: "rounded-2xl bg-neutral-50 border border-neutral-200 p-8 text-center"
```

### 入力

**Email / Single-line text**
```
className: "mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
```

**Textarea**(自由記述)
```
className: "w-full rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 text-base leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
```
- `rows={5}` デフォルト

### MoonPhase(身体感覚タップ用、カスタム SVG)

`components/MoonPhase.tsx`、phase 1-5 で 新月 → 三日月 → 上弦 → 十三夜 → 満月。色は固定 `#f5d49a`(amber)。

- **5タップ選択**:`w-10 h-10`(40px)
- **カレンダー日マーカー**:`w-3.5 h-3.5`(14px)
- **詳細画面 large**:`w-10 h-10` 〜 `w-12 h-12`
- **完了画面 hero**:`w-20 h-20`(80px)

### AppHeader

```
className: "sticky top-0 z-10 bg-neutral-50/80 backdrop-blur-md border-b border-neutral-200/60"
```
- ロゴ:`<img src="/icon-mark.svg" className="w-5 h-5" />` + 「ほしふみ」
- Streak chip:amber テキスト on amber-tinted dark bg、「{n}つ灯った」フォーマット

### トグル / スイッチ / チェックボックス

現状未実装。追加時は border-neutral-200 / 選択時 border-primary-500 / bg-primary-50 のパターンを踏襲。

### ローディング状態

- ボタン:`disabled` + コピーを「保存中…」「送信中…」に置換
- ページ:SSR で fetch、loading skeleton は現状未実装(必要になったら設計)

### エラー状態

- インライン:`text-sm text-red-600 text-center` をフォーム下に
- raw エラーは表示しない、日本語の friendly な文言にマップ

---

## 5. レイアウト原則

### コンテナ

- ページ全体:`max-w-md mx-auto`(モバイル基準の最大幅、約 448px)
- 横 padding:`px-6`(24px)を ページ wrapper レベルで一度だけ適用、個別セクションには付けない

### 縦のリズム

- セクション間:`space-y-8`(32px)or `space-y-6`(24px)
- 関連要素間:`space-y-4`(16px)or `space-y-3`(12px)
- カード内本文間:`space-y-2`(8px)

### 間(ま)

- **余白多め**は世界観に必須
- 情報密度低く、コンテンツとコンテンツの間に呼吸を
- 1画面1主役、それ以外は subordinate

### 角丸

- 入力 / 小ボタン:`rounded-xl`(12px)
- カード / 大ボタン:`rounded-2xl`(16px)
- 強調カード / 完了パネル:`rounded-2xl` 以上
- チップ / アイコンボタン:`rounded-full`
- 鋭角・小さい radius は NG(`rounded-md`、`rounded-sm` は使わない)

### タッチターゲット

- 最低 `44 × 44 pt`(Apple HIG)
- 5タップ系は `p-3`(12px padding)で十分な margin 確保

---

## 6. 深度とエレベーション

### 哲学

世界観は「深い夜の void に浮かぶ small warm points」。**影は基本的に使わない** ─ 影は光源を示唆し、暗闇の中に強い光源を置くと clinical / harsh になる。

代わりに:
- **背景色の lightness 差**で elevation を表現(body L=12% → card L=18% → hover L=24%)
- **subtle border** で輪郭を示す(border-neutral-200、warm dark tint)
- **必要な場合**のみ非常に控えめな shadow

### シャドウトークン

| Tailwind クラス | 用途 |
|---|---|
| `shadow-sm` | Primary CTA 直下(月の "灯" 感)─ 控えめに |
| `shadow`、`shadow-md`、`shadow-lg` | **使わない**(過剰、世界観に合わない) |
| なし | デフォルト ─ ほぼすべての card / surface |

### グロー(将来検討)

将来、callback カードや CTA ボタン周りに **warm amber glow halo**(soft blur amber)を追加することは worldview と一致。現状は実装してない。導入時は別 ADR。

---

## 7. やること・やらないこと

統合 anti-pattern カタログは `docs/WORLDVIEW.md` の "NO list" 表を参照。ここでは要点のみ。

### ✅ やる

- 深い indigo bg + warm amber accent の二層
- `Zen Maru Gothic` font、丸ゴ系で warm
- 余白多め(`px-6` wrapper + `space-y-8` セクション間)
- `rounded-xl`/`rounded-2xl`/`rounded-full` の柔らかい曲線
- fade + breath motion(slide や bounce は不可)
- 「だね/だよ」距離近めの常体コピー、改行で間を作る
- カスタム SVG アイコン(`MoonPhase`、`icon-mark.svg`)
- ユーザー自身の言葉を AI が引用するパターン(ADR-016)
- streak は「○つ灯った」のような soft 数え方

### ❌ やらない

- 純白 / 純黒(`bg-white`、`text-white`、`#fff`、`#000`)
- システム絵文字(🌧 ☀ 🔥 等)─ カスタム SVG を使う
- 明朝以外の sans-serif(Inter / Helvetica 系)
- "Production verbs"(「送信する」「達成」「タスク」)─ 「置く」「灯す」を優先
- "○日連続" 強調、🔥 fire emoji、achievement バッジ、leaderboard
- AI の要約、ラベリング、診断、助言、パターン announce(引用係原則違反)
- Bouncy/slidey motion、spring、jump
- 明るいコントラスト、saturated primary、neon、ネオン accent
- 小 radius / 角張ったアイコン / 硬い幾何形
- 朝/日中 mode を主体的にフレーミング(現状 out of scope)

---

## 8. レスポンシブ挙動

### 主要ターゲット

**iOS Safari モバイル PWA**(ホーム画面追加、standalone モード)。デフォルト想定 viewport:`375 × 812`(iPhone 13 mini 級)〜 `430 × 932`(iPhone 15 Pro Max 級)。

### ブレイクポイント

現状 **モバイル一本**、明示的なブレイクポイント未設定。`max-w-md`(448px)wrapper で全幅 ≤ 448px に collapsed する。

将来 web ブラウザ width 対応する場合:
- `sm`(640px):wrapper を `max-w-md` 維持、左右 margin が増えるだけ(intentionally narrow ─ モバイル感を残す)
- `md`(768px):同上
- `lg`(1024px):同上、または別 layout を検討(まだ ROADMAP になし)

### PWA / セーフエリア

`@supports (padding: env(safe-area-inset-bottom))` で iOS notch / home indicator に対応(`app/globals.css` 既設)。

### 画面の向き

縦向き想定(`portrait`)。横向きは support するが、最適化対象外。

---

## 9. エージェント向けプロンプトガイド

AI コーディングエージェント(Claude Code 等)が新規 UI を生成する際の、このプロジェクト固有のプロンプト前提。

### 必読

新しい UI / コンポーネント / 画面を生成する前に、以下を全部読んでから着手:
1. **このファイル(`docs/DESIGN.md`)** ─ tokens、コンポーネントパターン、layouts
2. **`docs/WORLDVIEW.md`** ─ yes/no anti-pattern カタログ、コピーパターン
3. **`docs/DECISIONS.md`** ADR-016, 017, 019 ─ 引用係原則、callback algorithm、worldview
4. **`app/globals.css`** ─ token の canonical 値
5. 既存コンポーネント(`components/`、`app/today/_components/` 等) ─ 真似する pattern

### クイックチェックリスト

UI 生成後、出荷前に以下をチェック:

- [ ] 全色が `bg-neutral-*` / `bg-primary-*` 等の token、ハードコード hex なし
- [ ] `bg-white` / `text-white` 使ってない
- [ ] システム絵文字を UI で使ってない(brand 絵文字以外)
- [ ] フォントは Zen Maru Gothic に解決される(クラス指定なしで body から継承)
- [ ] Border radius は `rounded-xl` 以上(`rounded-md`/`rounded-sm` 使ってない)
- [ ] Motion は fade / breath のみ(slide/bounce/spring 使ってない)
- [ ] コピーは「だね/だよ」常体、改行を強く使ってる、production verb 避けてる
- [ ] AI 機能の場合:引用係原則準拠(要約・ラベル・診断してない)
- [ ] Streak は「○つ灯った」フォーマット、「○日連続」になってない

### 構成手順

新しい画面を構成するときの順序:
1. `app/{route}/page.tsx` を作る、`AppHeader` を入れる
2. wrapper:`<main className="min-h-dvh">` → `<div className="px-6 py-8 max-w-md mx-auto">`
3. 上部:タイトル(`text-2xl font-bold text-neutral-900`)+ subtitle(`text-sm text-neutral-500`)
4. 主コンテンツ:カード(`rounded-2xl bg-neutral-50 border border-neutral-200 p-5`)を `space-y-6` で並べる
5. CTA:Primary button を bottom 近くに

### 要求しないこと

このプロジェクトでは AI エージェントに以下を要求しない:
- 新しい color token(palette は固定、追加が必要なら ADR 起こす)
- 新しい font family(Zen Maru Gothic 固定、変更は ADR)
- Shadow elevation system(影は使わない方針)
- Light mode toggle(明示的 out of scope per ADR-019)

迷ったら、CLAUDE.md の "Worldview / design north star" セクションに戻る。
