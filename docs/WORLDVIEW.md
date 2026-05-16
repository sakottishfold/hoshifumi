# 世界観(WORLDVIEW)

> ほしふみの北極星。全 visual / コピー / motion / AI 挙動 / プロダクト判断はこれに照らされる。
> ADR-019 が canonical decision、この doc は **日々参照される operational reference**。
> 最終更新: 2026-05-16

---

## ひとことで

> **夜、ふとんから星を見上げるアプリ**

リトマス試験:
> **「これは横たわってベッドで自身の蓄積する journaling 星空を見上げる人と一致するか?」**

すべての設計判断で、この問いをくぐらせる。

---

## なぜこの世界観か(簡潔)

- **Atmospheric が activity に勝つ**:「使ったときの感触」は「ユーザーが何をするか」より長持ち
- **多層で成長余地あり**:enclosure(privacy)/ 上向き gaze(navel-gazing なしの内省)/ 星(蓄積)/ 月(循環時間)/ 暗さ(休息)
- **プロダクト緊張を解決**:ease vs depth、streak vs no-pressure、AI value vs autonomy ─ 全部この像で和解する

詳細は **ADR-019** 参照。

---

## YES リスト:この世界に含まれるもの

すべての visual / copy / motion の判断は、これらの方向に寄せる。

| 要素 | 具体 |
|---|---|
| **姿勢** | 受動的、横たわっている、surrendered。production していない |
| **視線** | 上向き、外向き / cosmic、それが内向きに turn する |
| **空間** | enclosed safety(ふとん)+ vast openness(夜空)の二層 |
| **光の質** | 深い暗さの上の warm small point。「灯」のスケール感 |
| **音/沈黙** | デフォルト沈黙。喋るときはユーザーを引用するときだけ |
| **時間** | 月相が progress、過去エントリが再 surface、アーカイブが個人の空に |
| **テンポ** | 遅い / breathing。fade と breath motion |
| **色温度** | 温かい(amber、warm cream)、寒色は避ける |

---

## NO リスト:この世界が拒むもの(アンチパターンのカタログ)

「これ NG だっけ?」と思ったときの統合参照。複数の ADR / PRD に散らばっているのを一箇所に集約。

| NG | 代わりに | 出典 |
|---|---|---|
| Production / work verbs(「送信する」「達成」「タスク」) | 「置く」「灯す」「眠る前に」 | ADR-019 |
| Streak 罰系コピー(「○日連続が途切れた」)| 「○つ灯った」(soft 化)、または無言 | ADR-008, ADR-019 |
| Streak 強調 emphasis(badge、leaderboard、競争 UI) | 静かに数字を表示、それ以上演出しない | ADR-008 |
| スコア・数値評価・ランキング・"performance" チャート | 数値は出すなら raw、評価しない | ADR-008, ADR-019 |
| 明るいコントラスト / loud カラー(saturated primary、純白背景、ネオン) | dark indigo bg + warm amber accent | ADR-019 |
| 鋭い / rigid forms(小さい border-radius、角張ったアイコン) | rounded(rounded-3xl 以上)、柔らかい曲線 | ADR-019 |
| Bouncy / slidey motion(spring、slide-in、jump アニメ) | fade と breath | ADR-019 |
| AI による要約(「あなたは○○な傾向です」) | ユーザーの言葉を verbatim で引用する | ADR-016 |
| AI のカテゴリラベリング(気分・性格・ストレスレベル) | 引用と配置のみ、ラベルなし | ADR-016 |
| AI の診断・診断ヒント | 一切しない | ADR-016, PRD §3 |
| AI の助言・推奨・予測 | しない | ADR-016 |
| 明示的解釈付きの「パターン検出」アナウンス | curate して見せる、パターンを名付けない | ADR-016 |
| システム絵文字(🌧 ☀ 🔥 等) | カスタム SVG(MoonPhase、icon-mark.svg) | ADR-019 |
| 朝 / 日中 usage を主フレーミング | 夜のための設計に留める、日中は out of scope | ADR-019 |
| Variable reward / 中毒性 UX パターン(infinite scroll 等) | 使わない | PRD §3 |
| ユーザーデータの売却・共有 | 絶対にしない | PRD §3 |
| メンタルヘルス診断的な振る舞い | しない、危機ホットライン情報を提示する設計 | PRD §3, §8 |

---

## 運用上の具体仕様

### 色(`app/globals.css` の `@theme` ブロック)

| 役割 | 値 | 補足 |
|---|---|---|
| Body 背景(画面 void) | `oklch(12% 0.04 280)` ≈ `#0a0a1a` | deep indigo、最も深い夜 |
| `neutral-50`(elevated card / input) | `oklch(18% 0.04 280)` ≈ `#15152a` | body より少し持ち上がった面 |
| `neutral-100`(hover) | `oklch(24% 0.04 280)` | |
| `neutral-200`(border) | `oklch(32% 0.03 280)` | dark 上でも識別可能 |
| `neutral-900`(本文テキスト) | `oklch(94% 0.02 75)` ≈ `#f4eddc` | warm cream off-white(月光) |
| `primary-500`(CTA bg、月) | `oklch(83% 0.10 80)` ≈ `#f0d4a0` | logo の三日月と同じ色 |
| `primary-600`(hover) | `oklch(73% 0.12 75)` | |
| `primary-50`(highlight bg) | `oklch(22% 0.03 75)` | subtle amber-tinted dark |

純白(`#ffffff`)・純黒(`#000000`)は使わない。神聖な対比は warm cream と deep indigo で作る。

### タイポグラフィ

- **Primary**: `Zen Maru Gothic`(Google Fonts、weights 400/500/700 ロード)
- **Fallback**: `Hiragino Maru Gothic ProN`(Mac/iOS native)
- **系統**: 丸ゴシック(warm rounded gothic)
- 明朝は試したが「普通」で温かみのドライバーにならず、丸ゴで温かさを獲得
- font-bold(700)も Zen Maru で十分美しく表示される
- 名前「ほしふみ」のひらがな表示が特に映える

### モーション

- **使う**: fade(opacity)、breath(slow scale 1.0 ↔ 1.02)、soft glow
- **使わない**: slide、bounce、spring、jump、shake、rotate、skeleton shimmer

> 具体的な duration / easing / 用途別 motion 表 / `prefers-reduced-motion` 対応 / Tailwind 実装例 / anti-pattern 詳細リストは **`docs/MOTION.md`** を参照(本セクションは yes/no 要点のみ保持)。

### コピーパターン

- **トーン**: 距離近めの「だね/だよ」、常体
- **句読点**: 緩め
- **改行**: 強く使う、改行で間(ま)を作る
- **長さ**: 短い、空白に語らせる

例:
```
おつかれ。
ひと呼吸して、
始めようか。
```

```
今夜のほしふみ、おやすみ。
また明日。
```

### アイコノグラフィー

- **絶対**:システム絵文字を UI で使わない(Apple/Google の visual world の侵入)
- **代わりに**:カスタム SVG
  - 三日月ロゴ:`public/icon-mark.svg`(透過背景版)/ `public/icon.svg`(indigo 正方形版)
  - 月相(身体感覚 5択):`components/MoonPhase.tsx`、phase 1-5 で 新月 → 三日月 → 上弦 → 十三夜 → 満月
- **色**:全部 amber `#f5d49a` 固定

### Streak の見せ方

- 数字 + 「つ灯った」を chip 表示(AppHeader)
- 「○日連続」「連続記録」は使わない
- Streak の rest / 罰系演出は一切なし
- 詳細は ADR-008 参照

---

## 参考(関連 ADR)

- **ADR-008** ─ streak 罰しない / ゲーミフィケーションなし(価値原則)
- **ADR-013** ─ Q1「身体感覚」(気分ではない、入口の選び方)
- **ADR-016** ─ AI は引用係(原則)
- **ADR-017** ─ Past-entry callback(γ stage model)
- **ADR-018** ─ 改名「ほしふみ」(名前と世界観の interlock)
- **ADR-019** ─ 本ファイルの canonical source

---

## 使い方

新規 UI / コピー / 機能を設計するときの手順:

1. **リトマス試験**を当てる:「ふとんで横になって星を見上げる人と一致するか?」
2. **YES リスト**との一致を確認:該当する要素は何個ハマるか
3. **NO リスト**をスキャン:どれかに抵触しないか
4. 抵触するなら、代案を NO リストの「代わりに」列から考える
5. 迷ったら **CLAUDE.md の Worldview ノート** か **ADR-019** に立ち戻る

このファイル自体も世界観の進化に合わせて update する(=living doc)。
