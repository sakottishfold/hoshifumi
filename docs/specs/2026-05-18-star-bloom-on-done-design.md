# Star Bloom on /today/done ─ Design

> Status: **承認待ち**(オーナーレビュー後 writing-plans へ)
> 日付: 2026-05-18
> ブレスト履歴: 本セッション(2026-05-18)、user request「投稿した数によって星が降ってくる演出を加えたい」起点
> 関連: ADR-019(worldview)/ ADR-017(callback stages)/ ADR-008(streak 罰しない)/ WORLDVIEW.md(NO list: slide/bounce)/ MOTION.md(fade/breath 原則)

---

## 1. Overview

`/today/done` の hero 月相を「**今日の Q1 body sensation の phase**」に置換し、ページ着地時に soft な bloom + glow pulse で「咲く」演出を加える。さらに entry-count milestone(5 / 15 / 25 / 35 / 100 / 365)初到達時に、中心月相の bloom + 周囲の generic 小光が staggered fade-in する burst を発火させる。

motion は **α 厳格**:slide / bounce / spring 一切なし、scale + opacity + box-shadow glow のみ。`prefers-reduced-motion` で全 animation 無効化。

---

## 2. Context と決定の経緯(ブレスト要約)

| 決定点 | 採用 | 理由 |
|---|---|---|
| 発火 moment | 常時(submit のたび) + 節目(milestone) | E 複合、worldview「日々の小さな灯」+「節の祝い」両立 |
| 「数によって」の意味 | ii(各 submit で 1 新星)+ iii(節目 burst) | 累積を毎回再演出する i は寝る前 UI として重い |
| accumulate 可視化 | (a) 演出 only ─ v1.0 scope | (b) 常設夜空は v1.1+、(c) 専用画面は v1.2+ に延期 |
| worldview tension(「降ってくる」 vs no-slide) | α 厳格 | 実落下なし、bloom + glow で「現れる」を表現。NO list を曲げない |
| 星のグリフ | (iv) Mix ─ 中心は今日の MoonPhase、節目周囲は generic 小光 | 「自分の今日が星になる」+ お祝いの軽さ両立 |
| milestone しきい値 | (c) hybrid ─ 5/15/25/35(ADR-017 stage 同期)+ 100/365 | callback unlock とダブル meaning、長期 user も拾える |
| hero との関係 | B ─ 今日の月相がヒーローを置換 | 現状の固定 phase 5 は形式的、置換で entry の体感が直接報われる |

ADR-008(streak 罰しない)観点:
- entry-count ベース(連続日数ではない)→ skip day で破壊されない
- 各 milestone は **初到達時に1回だけ**発火、再演出なし(過剰でない)
- お祝いの「軽さ」を star 数(最大 7-8)と動きの slowness で抑制

ADR-019(worldview)観点:
- 「夜、ふとんから星を見上げる」体験で、自分の今日が glyph として一瞬灯る
- glow pulse は breath motion 原則と整合(scale 1.0 ↔ 1.02 ではなく blur の呼吸)
- 静かさを失わない:常時は1星、節目だけ最大 7-8 star、それ以上は出さない

---

## 3. User Experience

### 3.1 常時(every submit)

1. user が `/today` で Q1/Q2/Q3 submit
2. `/today/done?streak=N&phase=P&total=M` に redirect
3. ページ render と同時にヒーロー月相(phase P)が:
   - `scale 0 → 1.0`
   - `opacity 0 → 1.0`
   - 上記 2 つ並行で 1500ms、`ease-out`
4. bloom 完了後、glow が呼吸開始(`box-shadow` の amber blur radius が `1.0 ↔ 1.04` の 3000ms infinite)
5. streak card / callback card は通常通り表示(これらは既存挙動、変更なし)

### 3.2 節目(milestone first reach)

`total === 5 | 15 | 25 | 35 | 100 | 365` の場合追加で:

1. ヒーロー bloom 完了(1500ms 経過)
2. 200ms 待機
3. 周囲 N 個の small light(amber dot 4-8px + soft halo)が 100ms 間隔で 1 つずつ fade-in
4. 全 small light は heroる位置周辺 80-120px 半径内にランダム配置(乱数 seed = total、再現性あり)

milestone tier:
- 5 / 15 / 25 / 35:**small tier**、small light 3 個
- 100:**medium tier**、small light 5 個
- 365:**large tier**、small light 7 個 + glow ハロー radius 1.5x

burst 全体の duration:約 2000-2500ms。

### 3.3 reduced motion

`prefers-reduced-motion: reduce` のとき:
- bloom なし、ヒーロー月相は最初から完全表示
- glow pulse なし、static
- burst なし(small lights も出ない、milestone でも演出スキップ)
- これは worldview NO list の精神(無理に動かさない)と一致

### 3.4 グラフィカルなまとめ(MoonPhase は SVG component)

```
/today/done 着地:

  [AppHeader: ほしふみ + 「Mつ灯った」chip]
  
            🌗  ← scale 0→1 + opacity 0→1 で bloom
                 (今日の Q1 phase = ここでは waxing gibbous の例)
                 完了後 glow が breath で呼吸
  
        今日もありがとう
        また明日、待ってます
  
       ┌─ 灯した夜 ─┐
       │     Mつ     │
       └─────────────┘
  
  [CallbackCard あれば]
  
  [これまでのほしふみを見る →]
```

milestone(例: total === 5):

```
  ✦       🌗      ✦      ← 中心 bloom 後に staggered fade-in
       ✦
  
        今日もありがとう
        ...
```

---

## 4. Architecture

### 4.1 新規 component:`components/BloomMoon.tsx`

```typescript
import type { MoonPhase as MoonPhaseValue } from "@/lib/types";

interface BloomMoonProps {
  /** 1-5: 今日の Q1 body sensation phase */
  phase: 1 | 2 | 3 | 4 | 5;
  /** milestone 初到達時のみ指定、undefined なら常時演出のみ */
  burst?: {
    /** small light の個数(3 / 5 / 7) */
    count: number;
    /** tier 名、glow ハロー強度に影響 */
    tier: "small" | "medium" | "large";
    /** ランダム配置の seed(total entries を渡す、再現性確保) */
    seed: number;
  };
  /** デフォルト hero サイズ "w-20 h-20"(80px)、上書き可能 */
  className?: string;
}

export function BloomMoon({ phase, burst, className }: BloomMoonProps): JSX.Element;
```

内部構成:
- 既存 `<MoonPhase phase={phase} />`(narrow props、touch しない)を中心に配置
- 周囲 small lights は `<span>` + Tailwind animation utilities or CSS keyframes
- `prefers-reduced-motion` 検出は `@media (prefers-reduced-motion: reduce)` ですべての animation を無効化(CSS で対応、JS 不要)

### 4.2 既存 component への影響

- `components/MoonPhase.tsx`:**変更なし**(narrow props、reuse)
- `components/CallbackCard.tsx`:**変更なし**(独立した surface)
- `app/today/done/page.tsx`:`<MoonPhase phase={5} />` → `<BloomMoon phase={...} burst={...} />`

### 4.3 ヒエラルキー

```
app/today/done/page.tsx
└─ <BloomMoon phase={P} burst={...} />
   ├─ <MoonPhase phase={P} />  (既存)
   └─ {burst && <small lights × N>}  (新規)
```

---

## 5. Data Flow

### 5.1 submit から done へ

現状の `submitEntry()` は `{ success, entryId, streak }` を返す。これに 2 つ追加:
- `bodyPhase: 1|2|3|4|5`(input.bodySensation そのまま)
- `totalEntries: number`(`completed_at IS NOT NULL` な entries の count、新規 query)

client(`QuestionFlow.tsx` 等の submit 後 handler):
```ts
const { streak, bodyPhase, totalEntries } = await submitEntry({...});
router.push(`/today/done?streak=${streak}&phase=${bodyPhase}&total=${totalEntries}`);
```

### 5.2 done page で milestone 判定

```ts
const MILESTONES = [5, 15, 25, 35, 100, 365] as const;
const BURST_TIER: Record<number, { count: number; tier: "small" | "medium" | "large" }> = {
  5: { count: 3, tier: "small" },
  15: { count: 3, tier: "small" },
  25: { count: 3, tier: "small" },
  35: { count: 3, tier: "small" },
  100: { count: 5, tier: "medium" },
  365: { count: 7, tier: "large" },
};

const total = parseInt(params.total ?? "0", 10);
const burst = total in BURST_TIER
  ? { ...BURST_TIER[total], seed: total }
  : undefined;
```

---

## 6. Error Handling

| ケース | 挙動 |
|---|---|
| `?phase` 不在 | fallback `phase=5`(現状の固定挙動を維持、regression なし) |
| `?phase` が 1-5 範囲外 | clamp して `phase=5`、log なし(client error) |
| `?total` 不在 | `total=0`、burst なし(silent) |
| `?total` が milestone でない値 | burst なし、常時演出のみ |
| `prefers-reduced-motion: reduce` | 全 animation 無効、static 表示 |
| 古いブラウザで `box-shadow` animation 未対応 | fallback で glow なし、bloom のみ |

### URL tampering について

ユーザーが手で URL を `?total=5` に書き換えれば burst を任意に発火させられる。これはセキュリティ問題ではなく:
- 害なし(視覚演出のみ、データ書き込みなし)
- 厳密性必要なら done page server で DB の total entries を fetch して照合可能、ただし scope 外(YAGNI)

---

## 7. Implementation Scope

### In scope(v1.0、本 design)

- `components/BloomMoon.tsx` 新規
- `app/today/done/page.tsx` の hero 置換
- `lib/server-actions/entries.ts` の `submitEntry` 戻り値拡張(bodyPhase + totalEntries)
- `app/today/_components/QuestionFlow.tsx`(or 該当 client component)の redirect URL 拡張
- CSS:Tailwind utilities + `app/globals.css` に bloom / glow / fade-in keyframes 追加(`@keyframes` ブロック)
- WORLDVIEW.md / MOTION.md に新 motion カテゴリ追記(bloom + glow を fade/breath 系の許容例として明示)

### Out of scope(future)

- 過去星の constellation 化(v1.1+、本 design でいう (b)/(c))
- 専用「夜空」画面(v1.2+)
- 効果音 / BGM
- ヒーロー以外の場所での bloom(orbit パターン C は実装しない)
- entry 数表示・統計画面
- milestone を表示 UI で明示(「節目だ!」とは言わない、視覚のみ)

---

## 8. Testing

CLAUDE.md「v0 はテストなし、v1.0 launch 前に Playwright 導入」方針に従い、**自動テストなし**。

手動 smoke:
- [ ] entry submit → done で月相が bloom → glow pulse
- [ ] body phase 1〜5 全部で正しく描画
- [ ] seed SQL で entry-count = 5 を再現 → small burst 発火
- [ ] entry-count = 100 / 365 を擬似入力 → medium / large burst 発火
- [ ] Mac システム環境設定で「視差効果を減らす」ON → static になる
- [ ] iOS Safari 実機で 60fps 維持(Performance タブで)

---

## 9. Open Questions(設計時点で残ってる、実装中に解消する想定)

- bloom keyframes の cubic-bezier 詳細値(`ease-out` ベースで 3 案出して 1 つ選ぶ、実装時)
- glow ハロー の amber blur radius と spread の具体値(MOTION.md と合わせて実機調整)
- burst 時の small light の位置算出 algorithm(乱数 seed 付き、`hashCode(seed) → angle / distance` で再現性確保)
- WORLDVIEW.md / MOTION.md 更新の文言(別タスクで worldview-keeper に dispatch)

---

## 10. References

- ブレスト履歴:本セッション 2026-05-18
- ADR-019:worldview canonical decision
- ADR-017:callback γ stage モデル(milestone 5/15/25/35 アライン元)
- ADR-008:streak 罰しない原則
- WORLDVIEW.md:NO list(slide/bounce)、YES list(fade/breath/glow)
- MOTION.md:motion 仕様
- DESIGN.md:カラー / typography / component patterns
- 既存 component:`components/MoonPhase.tsx`、`components/CallbackCard.tsx`
