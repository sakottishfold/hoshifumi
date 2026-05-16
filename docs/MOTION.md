# MOTION.md ─ ほしふみ モーション仕様

> モーションは世界観の time axis である。色・タイポ・形が「どんな世界か」を答えるのに対し、モーションは「その世界はどう呼吸するか」を答える。
> このプロジェクトの全てのモーション(transition、animation、interaction feedback)はこの doc の規範に従う。
>
> 関連 doc:
> - 哲学・なぜ:`docs/WORLDVIEW.md`(Motion セクション + yes/no list)
> - 決定の canonical:`docs/DECISIONS.md` ADR-019(worldview)
> - トークン実装:`app/globals.css` + Tailwind 標準 utility
>
> 最終更新: 2026-05-16

---

## 1. 哲学

### なぜ fade と breath なのか

ほしふみの世界観 ─ 「夜、ふとんから星を見上げるアプリ」(ADR-019)─ から、許容されるモーションの種類は厳密に決まる。

**夜空のもの**は、横にずれない。星は flash しない。雲は jump しない。月は spring back しない。それらは静かに **現れ・消え・呼吸する**。

- **Fade(opacity の遷移)** ─ 星が空に「現れる」「霞む」「再び現れる」のメタファ。callback で過去エントリが届くとき、入眠前にコンテンツがそっと提示されるとき、これは唯一正しい motion
- **Breath(極小 scale の往復)** ─ 生きているものの呼吸、眠っている人の胸の上下。CTA や callback カードが「そこにいる」ことを controlled に示すのに適する
- **Soft glow(極小 box-shadow / opacity halo の遷移)** ─ 星の光のゆらぎ。amber accent との相性が良い。現状未実装、将来導入可能(別 ADR)

### なぜ slide / bounce / spring が NG なのか

| NG モーション | なぜ世界観に反するか |
|---|---|
| **Slide-in panel**(右からスッ等) | 「物が動く」「物理が存在する」感を強く出す。横たわって見上げてる人にとって、横に流れるものは違和感(空は横に流れない、自分が動いてないのに) |
| **Bounce / spring 物理** | playfulness を演出するが、playfulness は work / production の感触に近い(Slack、Notion、Linear)。寝る前の儀式は playful ではなく contemplative |
| **Jump / shake** | attention-grabbing。アプリが「ねえ見て」と話しかけてくる。沈黙原則(WORLDVIEW NO list)違反 |
| **Skeleton shimmer** | テック感が強い。生成中・処理中の "AI 感" を可視化する典型。寝る前にこの emphasis は不適 |
| **Spinner(回転)** | clinical / busy。「忙しい」を示すモーションは「ゆっくりした夜」に矛盾 |
| **過剰な hover transform** | hover で要素が拡大・浮き上がる挙動は energetic / interactive を主張する。控えめが正解 |

### 一段抽象化したルール

このプロジェクトのモーションを設計するときに当てる3つの問い:

1. **「これは星が現れる/消えるように見えるか?」** ─ Yes なら OK
2. **「これは寝ている人の呼吸のように見えるか?」** ─ Yes なら OK
3. **「これは物が動くように見えるか?」** ─ Yes なら **再考**(物理がない世界なので)

---

## 2. タイミングのトークン(canonical 値)

Tailwind v4 のデフォルト duration / ease scale をベースに、このプロジェクトで使う **限られたサブセット** を canonical 化する。これ以外は使わない。

### デュレーション

| トークン | ms | Tailwind クラス | 使いどころ |
|---|---|---|---|
| `instant` | 100ms | `duration-100` | active state(ボタン押下の縮み)、focus ring の出現 |
| `quick` | 200ms | `duration-200` | hover state、small element の transition |
| `gentle` | 300ms | `duration-300` | カードの fade-in、modal の出現(将来) |
| `breath` | 600ms | `duration-[600ms]` | callback カードの fade-in、page transition |
| `slow` | 1000ms | `duration-1000` | 主役要素の fade-in、done 画面の hero |
| `whisper` | 1500ms | `duration-[1500ms]` | breath loop の片方向(scale 1.0 → 1.02 にかかる時間)|

> 100ms 未満は使わない(視認できないので意味がない、しかし無駄に CPU は使う)。
> 1500ms 超えは breath loop 以外で使わない(待たされてる感が出る、儀式のリズムを壊す)。

### イージング

| トークン | cubic-bezier | Tailwind クラス | 性質 |
|---|---|---|---|
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | `ease-out` | **デフォルト**。出現するもの全部(fade-in、現れる、appear) |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | `ease-in-out` | breath loop の両方向、双方向の遷移 |
| `ease-linear` | `linear` | `ease-linear` | opacity-only の subtle transition(避けるよりはマシ、ただし基本 ease-out 推奨) |

**使わないイージング:**

- `ease-in`(`cubic-bezier(0.4, 0, 1, 1)`)─ 最後に加速する。出現に使うと「飛び込む」感が出る、世界観に反する
- spring 系 easing(`cubic-bezier(0.34, 1.56, 0.64, 1)` 等)─ overshoot する曲線は bounce そのもの。NG
- step 系(`steps()`)─ 段階的アニメは tech / robotic。NG

---

## 3. 用途別モーション表

実装するときの canonical reference。新規 UI を作るときはまずこの表を見て、該当 use case があるならその値を踏襲する。

| ユースケース | プロパティ | デュレーション | イージング | 備考 |
|---|---|---|---|---|
| **Page transition**(ルート切替の fade) | `opacity 0 → 1` | 600ms | ease-out | Next.js App Router の standard navigation。明示的な animation は基本不要、ただし重要画面では layout 内で fade-in を明示してよい |
| **Card 出現**(初回 mount 時) | `opacity 0 → 1` | 600ms | ease-out | callback カード、done 画面の hero カード等 |
| **Card 出現(やや slow)** | `opacity 0 → 1` | 1000ms | ease-out | done 画面の primary 要素、「ふと出てくる」感が強いもの |
| **Button hover** | `background-color` | 200ms | ease-out | `hover:bg-primary-600` 等。transform は使わない |
| **Button active(押下)** | `transform: scale(1 → 0.99)` | 100ms | ease-out | `active:scale-[0.99]`。0.97 以下は強すぎる |
| **Input focus**(border + ring 出現) | `border-color`, `box-shadow` | 200ms | ease-out | `focus:border-primary-500 focus:ring-2` |
| **Callback fade-in**(`/today/done` で過去エントリが現れる) | `opacity 0 → 1` | 1000ms | ease-out | mount 後 200-400ms 遅延させて「ふと出てくる」感を強める(`animation-delay`)|
| **Breath loop**(主役要素の生命感) | `transform: scale(1.0 ↔ 1.02)` | 3000ms full cycle(1500ms 片道) | ease-in-out | infinite alternate。CTA や callback カードに控えめに適用、複数同時起動は避ける(画面で1要素のみ)|
| **MoonPhase tap feedback**(身体感覚選択時) | `transform: scale(1 → 0.97 → 1)`, `border-color` | 200ms | ease-out | tap した phase の subtle confirm |
| **Streak chip 数字変化**(「○つ灯った」の数字が増えるとき) | `opacity` cross-fade | 600ms | ease-out | 数字 spin / count-up は **使わない**(ゲーミフィケーション感) |
| **Loading state**(API call 中) | テキスト置換のみ | n/a | n/a | 「保存中…」「送信中…」と文字を書き換える。spinner / skeleton は使わない |
| **Error message 出現** | `opacity 0 → 1` | 300ms | ease-out | shake / wiggle は使わない |
| **Modal / Dialog 出現**(将来) | `opacity 0 → 1` + `transform: scale(0.98 → 1)` | 300ms | ease-out | scale は controlled に。slide-up は使わない |
| **Toast / 通知**(将来) | `opacity 0 → 1` | 300ms | ease-out | slide-in は使わない。fade-in で十分 |

### breath loop の実装ヒント

```css
@keyframes breath {
  0%, 100% { transform: scale(1.0); }
  50%      { transform: scale(1.02); }
}

.animate-breath {
  animation: breath 3s ease-in-out infinite;
}
```

`app/globals.css` に `@theme` ブロック外で `@keyframes` 定義 + utility class 追加が standard。Tailwind v4 の `@utility` 構文も可。

---

## 4. `prefers-reduced-motion` 対応方針

OS / ブラウザの「視差効果を減らす」設定を ON にしているユーザーは、前庭系の感受性が高いか、認知的負荷を下げたいケース。**ほしふみは元々 motion が控えめなので影響範囲は小さい**が、明示対応する。

### 規範

1. **`@media (prefers-reduced-motion: reduce)` を `app/globals.css` で global に書く**:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

2. **Breath loop は完全停止**(`animation-play-state: paused` ではなく、duration を 0 に潰す)。生命感は失われるが、controlled な代替として border の subtle highlight 等で「そこにある」を示す
3. **Fade transition は維持してよい**(過剰な視覚効果ではないので)─ ただし上記グローバル設定では 0.01ms に潰している。これは保守的選択。今後ユーザーフィードバックがあれば、fade のみ 200ms 維持の例外ルールを検討
4. **content の即時出現は OK**:reduce 環境では「ふと出てくる」演出よりも「最初から存在している」方が予測可能で優しい

### Tailwind での明示的な書き方

特定要素で reduce-motion を意識的に handle する場合:

```tsx
<div className="opacity-0 animate-fade-in motion-reduce:animate-none motion-reduce:opacity-100">
```

`motion-reduce:` variant は Tailwind 標準。global 設定が基本だが、要素単位で fallback を効かせたいときに使う。

---

## 5. Tailwind での実装例

このプロジェクトで使う実装パターン。組み合わせの幅は意図的に狭く保つ。

### トランジション utility(主に hover / focus / active)

```tsx
// Primary CTA(hover で背景色遷移)
<button className="rounded-xl bg-primary-500 px-4 py-3 text-base font-medium text-neutral-50 shadow-sm transition-colors duration-200 ease-out hover:bg-primary-600 active:scale-[0.99]">
  つぎへ
</button>

// Input(focus で border + ring 遷移)
<input className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base transition-colors duration-200 ease-out focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />

// Card(hover で subtle 背景色変化、選択可能カードのみ)
<button className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 transition-colors duration-200 ease-out hover:bg-neutral-100">
```

### fade-in アニメーション(mount 時の出現)

`tailwindcss-animate` プラグインは v4 で動かない可能性があるため、`app/globals.css` で keyframes + utility を直書きする。

```css
/* app/globals.css */
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes breath {
  0%, 100% { transform: scale(1.0); }
  50%      { transform: scale(1.02); }
}

@utility animate-fade-in {
  animation: fade-in 600ms ease-out forwards;
}

@utility animate-fade-in-slow {
  animation: fade-in 1000ms ease-out forwards;
}

@utility animate-breath {
  animation: breath 3s ease-in-out infinite;
}
```

```tsx
// Callback カード(mount で fade-in、breath で生命感)
<div className="opacity-0 animate-fade-in-slow motion-reduce:opacity-100 motion-reduce:animate-none">
  <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6 animate-breath motion-reduce:animate-none">
    {/* 過去エントリ */}
  </div>
</div>
```

### `animation-delay` で「ふと出てくる」感

```tsx
// mount から 400ms 待って fade-in、`/today/done` の callback で使う
<div
  className="opacity-0 animate-fade-in-slow motion-reduce:opacity-100"
  style={{ animationDelay: "400ms" }}
>
```

inline style で `animationDelay` を渡すのは妥協(Tailwind に `delay-` utility はあるが transition 用、animation 用は弱い)。utility 化したい場合は globals.css に追加してよい。

---

## 6. アンチパターン一覧

具体的に避けるべき motion パターン。「これ使っていい?」と迷ったら、まずここを scan。

### モーション種類

| NG | 理由 |
|---|---|
| `slide-in-left/right/up/down` | 物理感、横たわってる人の visual world に物は流れない |
| `bounce` / `spring` / `elastic` easing | playful、production tool の感触 |
| `wiggle` / `shake` / `pulse`(強い) | attention-grabbing、沈黙原則違反 |
| `rotate` / `spin`(loading spinner 含む) | clinical / busy、夜のゆっくりした時間と矛盾 |
| `flip` / `3D transform` | tech 感、夜空に 3D は存在しない |
| `parallax` scroll | depth illusion、過剰演出 |
| `skeleton shimmer` | tech 感、生成中の AI 感を強調する典型 |
| `confetti` / `celebration` animation | achievement / ゲーミフィケーション、ADR-008 違反 |
| `marquee` / `auto-scroll text` | attention-grabbing、読まされてる感 |

### タイミング値の上限

| NG | 代わりに |
|---|---|
| デュレーション < 100ms(ほぼ無視できるが CPU 食う) | 100ms 以上、または animation 自体を削除 |
| デュレーション > 1500ms(breath loop 以外で) | 1000ms 以下に収める、または出現自体を rethink |
| Breath loop の片道 < 1000ms | 1500ms 以上(早すぎる呼吸 = 焦り) |
| Breath scale > 1.05 | 1.02 以下(大きい呼吸は痙攣に見える) |

### イージング

| NG | 代わりに |
|---|---|
| `ease-in`(最後に加速) | `ease-out`(最後に減速、世界観合致) |
| `cubic-bezier(*, *, *, > 1)` overshoot 系 | `ease-out` / `ease-in-out` |
| `steps()` 段階的 | continuous な ease 系 |
| 複雑な custom cubic-bezier(理由なく) | このファイルの3つ(ease-out / ease-in-out / linear)から選ぶ |

### 適用範囲

| NG | 代わりに |
|---|---|
| 1画面で 3個以上の breath loop 同時起動 | 主役 1要素のみ。複数あると "生きてる" 印象が分散 |
| 全 hover で transform: scale | 色変化(`hover:bg-*`)で十分。scale は active のみ |
| `transition-all` を default で多用 | `transition-colors`、`transition-opacity` 等プロパティを明示。`transition-all` は変化させたくない property も巻き込む |
| 主要 CTA に shake / pulse の attention-grabber | CTA は静か、色とサイズで自明にする |

---

## 7. 関連 ADR / WORLDVIEW.md の参照

新規モーション設計や既存挙動の見直しをするときの canonical 参照。

| 参照先 | 内容 |
|---|---|
| **`docs/DECISIONS.md` ADR-019** | プロダクト世界観の canonical decision。「夜、ふとんから星を見上げる」像。motion 制約はこの世界観から **演繹的に** 導出される |
| **`docs/DECISIONS.md` ADR-008** | streak 罰しない / ゲーミフィケーションなし。confetti / celebration animation 禁止の根拠 |
| **`docs/DECISIONS.md` ADR-016** | AI は引用係(skeleton shimmer / typewriter effect 等の "AI 生成中" 演出を派手にしない根拠) |
| **`docs/DECISIONS.md` ADR-017** | Past-entry callback。callback カードの fade-in と breath は本 doc §3 表で定義 |
| **`docs/WORLDVIEW.md` Motion セクション** | モーションの yes/no を1行ずつで持つ(本 doc のサマリ位置) |
| **`docs/WORLDVIEW.md` NO list** | 「Bouncy / slidey motion」「rigid forms」「明るいコントラスト」等、motion を含む anti-pattern 集約 |
| **`docs/DESIGN.md` §7 やること・やらないこと** | コンポーネントレベルでの motion 適用例(ボタン active state 等) |

---

## 8. 新規モーション追加時のフロー

新しい animation / transition を追加したいとき:

1. **本 doc §3 表に該当 use case があるか確認** ─ あれば、その値を踏襲して終わり
2. **なければ ADR-019 の litmus test を当てる**:「これはふとんで横になって星を見上げてる人にハマるか?」
3. **§6 anti-pattern list に抵触しないか scan**
4. **抵触するなら代案を考える**(本 doc §1 の3つの問いに戻る)
5. **新しい canonical value を作る場合は本 doc §3 表に行追加**。trivial でない判断(例:新しい easing curve、breath loop の値変更)は **新 ADR を起こす**
6. **`prefers-reduced-motion` 対応を必ず同時に書く**

---

## 使い方まとめ

- 新しい UI を作るとき:まず §3 表で該当 use case を探す → なければ §1 / §2 で derive する
- 既存 UI の motion を変更するとき:§6 anti-pattern を scan して NG じゃないか確認
- 「動きが少なすぎる」「もっと演出を」と思ったとき:**そう思うのが正しい**。ほしふみは静かなアプリ、motion は controlled な dose のみ
- 迷ったら ADR-019 と WORLDVIEW.md の litmus test に戻る
