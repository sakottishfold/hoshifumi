# Star Bloom on /today/done Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/today/done` のヒーロー月相を今日の Q1 body sensation phase で置換し、bloom + glow pulse + milestone burst の演出を加える。

**Architecture:** 新規 `BloomMoon` コンポーネントが既存 `MoonPhase` を内包し、CSS animation(`@keyframes`)+ `prefers-reduced-motion` 制御で bloom と glow を実装。entry-count milestone(5/15/25/35/100/365)初到達時のみ周囲に generic 小光が staggered fade-in する burst を発火。

**Tech Stack:** Next.js 16 App Router / React 19 / Tailwind v4(`@theme`)/ CSS keyframes / 既存 Supabase Server Action

**Spec reference:** `docs/specs/2026-05-18-star-bloom-on-done-design.md`

---

## File Structure

```
新規:
  components/BloomMoon.tsx              # bloom + burst を司る presentation component

修正:
  app/globals.css                       # @keyframes(bloom, glow-pulse, fade-in)+ reduced-motion override
  lib/server-actions/entries.ts         # submitEntry の戻り値に bodyPhase + totalEntries 追加
  app/today/_components/QuestionFlow.tsx # redirect URL に phase + total を追加
  app/today/done/page.tsx               # MoonPhase 直接利用 → BloomMoon に置換、milestone 判定

ドキュメント追記(Task 7):
  docs/WORLDVIEW.md                     # YES list に bloom / glow を明示追記
  docs/MOTION.md                        # 新 motion カテゴリの仕様
```

各ファイルは単一責任:
- `BloomMoon.tsx`:表示のみ、データは props 受け取り
- `globals.css` の追記:アニメーション宣言(component から `animate-*` ユーティリティ参照)
- `entries.ts`:データレイヤー(DB から count + body phase 取得)
- `QuestionFlow.tsx`:URL 組み立て
- `done/page.tsx`:milestone 判定ロジック + BloomMoon の組み立て

---

## Task 1: Add bloom / glow / fade-in keyframes に prefers-reduced-motion 対応

**Files:**
- Modify: `app/globals.css`(末尾に append)

- [ ] **Step 1: keyframes と animation utility class を globals.css 末尾に追加**

`app/globals.css` の末尾に以下を追記:

```css
/* ========================================
   Star Bloom animations (ADR-019 worldview, α 厳格)
   bloom = scale 0→1 + opacity 0→1, one-time
   glow-pulse = box-shadow amber blur breath, infinite
   fade-in-soft = opacity 0→1, one-time(burst の small light 用)
   ======================================== */
@keyframes bloom {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 12px 2px rgba(245, 212, 154, 0.25); }
  50% { box-shadow: 0 0 20px 4px rgba(245, 212, 154, 0.4); }
}

@keyframes fade-in-soft {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: scale(1); }
}

.bloom-animate {
  animation: bloom 1500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.glow-animate {
  border-radius: 9999px;
  animation: glow-pulse 3000ms ease-in-out infinite;
  animation-delay: 1500ms; /* bloom 完了後に開始 */
}

.fade-in-soft-animate {
  opacity: 0;
  animation: fade-in-soft 800ms ease-out forwards;
}

/* α 厳格 + worldview accessibility:reduced-motion で全 animation 無効 */
@media (prefers-reduced-motion: reduce) {
  .bloom-animate,
  .fade-in-soft-animate {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .glow-animate {
    animation: none;
    box-shadow: none;
  }
}
```

- [ ] **Step 2: typecheck で globals.css の影響なし確認**

Run: `npm run typecheck`
Expected: エラーなし(CSS の追記なので TS には影響しない、念のため)

- [ ] **Step 3: build で CSS が反映されることを確認**

Run: `npm run build`
Expected: success、Route 一覧出力

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: add bloom / glow-pulse / fade-in-soft keyframes (ADR-019 α 厳格)

prefers-reduced-motion で全 animation 無効化。BloomMoon component から
.bloom-animate / .glow-animate / .fade-in-soft-animate utility 参照。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: BloomMoon 新規コンポーネント

**Files:**
- Create: `components/BloomMoon.tsx`

- [ ] **Step 1: BloomMoon コンポーネントを書く**

`components/BloomMoon.tsx` を新規作成:

```typescript
// ADR-019 worldview: 今日の体感(MoonPhase)を bloom + glow で「灯る」感覚にする。
// milestone 初到達時のみ周囲に generic 小光が staggered fade-in(burst)。
// motion は α 厳格(no slide/bounce)、CSS keyframes は app/globals.css 定義。
// a11y: prefers-reduced-motion で全 animation 無効、static 表示にフォールバック。

import { MoonPhase } from "@/components/MoonPhase";

export interface BloomBurst {
  /** small light の個数(3 / 5 / 7) */
  count: number;
  /** tier 名、glow ハロー強度に影響 */
  tier: "small" | "medium" | "large";
  /** ランダム配置の seed(total entries を渡す、再現性確保) */
  seed: number;
}

interface Props {
  /** 1-5: 今日の Q1 body sensation phase */
  phase: 1 | 2 | 3 | 4 | 5;
  /** milestone 初到達時のみ指定、undefined なら常時演出のみ */
  burst?: BloomBurst;
  /** hero サイズの Tailwind class(default "w-20 h-20"=80px) */
  className?: string;
}

// 決定的な擬似乱数(seed から index ごとに角度・距離を返す)
// 同じ seed で同じ配置になる ─ レンダー再現性確保
function placeSmallLight(seed: number, index: number, total: number) {
  // 360 度を total 等分、seed で開始角度を回転、小さい乱数で揺らぎ
  const baseAngle = (360 / total) * index;
  const seedShift = (seed * 47 + index * 13) % 360;
  const jitter = ((seed * 31 + index * 17) % 21) - 10; // ±10度
  const angle = (baseAngle + seedShift + jitter) % 360;

  // 距離(中心からの半径、80-130px の範囲)
  const radius = 80 + ((seed * 23 + index * 7) % 50);

  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  return { x, y };
}

const BURST_DELAYS_MS = 100; // small light を 100ms 間隔で stagger
const BURST_START_DELAY_MS = 1700; // bloom 1500ms + 200ms 待機

export function BloomMoon({
  phase,
  burst,
  className = "w-20 h-20",
}: Props) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {burst &&
        Array.from({ length: burst.count }).map((_, i) => {
          const { x, y } = placeSmallLight(burst.seed, i, burst.count);
          const size =
            burst.tier === "large" ? 10 : burst.tier === "medium" ? 8 : 6;
          const delay = BURST_START_DELAY_MS + i * BURST_DELAYS_MS;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-primary-500 fade-in-soft-animate pointer-events-none"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                transform: `translate(${x}px, ${y}px)`,
                animationDelay: `${delay}ms`,
                boxShadow: `0 0 ${size * 1.5}px rgba(245, 212, 154, 0.6)`,
              }}
              aria-hidden="true"
            />
          );
        })}

      <div className={`bloom-animate ${className}`}>
        <div className="glow-animate w-full h-full">
          <MoonPhase phase={phase} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck で型 OK 確認**

Run: `npm run typecheck`
Expected: エラーなし。新しい型 `BloomBurst` と `Props` が正しく解決。

- [ ] **Step 3: build で BloomMoon が tree-shake されずに含まれることを確認**

Run: `npm run build`
Expected: success、`/today/done` route が ƒ で表示される(まだ BloomMoon は import されてないので変化なし、次タスクで)

- [ ] **Step 4: Commit**

```bash
git add components/BloomMoon.tsx
git commit -m "feat: add BloomMoon component (bloom + glow + milestone burst)

MoonPhase を内包、burst prop で small light を seed ベース配置。
.bloom-animate / .glow-animate / .fade-in-soft-animate utility は globals.css 定義。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: submitEntry 戻り値に bodyPhase + totalEntries 追加

**Files:**
- Modify: `lib/server-actions/entries.ts:16-67`

- [ ] **Step 1: submitEntry の戻り値型と count query を拡張**

`lib/server-actions/entries.ts` の `submitEntry` 関数を以下に置き換え(関数全体を差し替え、L16-67):

```typescript
export async function submitEntry(input: SubmitEntryInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const entryDate = input.date ?? todayJST();

  // entry upsert
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: entryDate,
        template_name: "basic",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entry_date" },
    )
    .select()
    .single();

  if (entryError) throw entryError;
  if (!entry) throw new Error("Failed to create entry");

  // 既存の回答を削除して新規挿入(シンプル化)
  await supabase.from("answers").delete().eq("entry_id", entry.id);

  const answers = [
    { entry_id: entry.id, question_position: 1, value_number: input.bodySensation },
    { entry_id: entry.id, question_position: 2, value_text: input.freeText },
    // ADR-014: Q3 now stored in value_text (was value_choice when Q3 was short_choice in v0).
    { entry_id: entry.id, question_position: 3, value_text: input.tomorrowMessage },
  ];

  const { error: answersError } = await supabase.from("answers").insert(answers);
  if (answersError) throw answersError;

  // 連続記録を更新
  const streak = await updateStreakForUser(user.id);

  // 通算完了 entry 数を取得(milestone burst 判定用)
  const { count: totalEntries, error: countError } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("completed_at", "is", null);

  if (countError) throw countError;

  revalidatePath("/today");
  revalidatePath("/calendar");

  return {
    success: true,
    entryId: entry.id,
    streak,
    bodyPhase: input.bodySensation,
    totalEntries: totalEntries ?? 0,
  };
}
```

- [ ] **Step 2: typecheck で戻り値型変化が他に影響しないか確認**

Run: `npm run typecheck`
Expected: エラーなし(QuestionFlow は次タスクで更新するが、戻り値拡張なので既存呼び出しは壊れない)

- [ ] **Step 3: build で server action として正しく compile される確認**

Run: `npm run build`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add lib/server-actions/entries.ts
git commit -m "feat: submitEntry returns bodyPhase + totalEntries

done page で milestone burst 判定 + 今日の MoonPhase 描画に必要。
count: exact + head: true で COUNT(*) 1回追加クエリ、行転送なし。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: QuestionFlow redirect URL に phase + total を追加

**Files:**
- Modify: `app/today/_components/QuestionFlow.tsx:64-66`

- [ ] **Step 1: handleSubmit の redirect 行を更新**

`app/today/_components/QuestionFlow.tsx` の以下の箇所(L64-66):

```typescript
        router.push(
          `/today/done?streak=${result.streak.streak_days}`,
        );
```

を以下に置換:

```typescript
        router.push(
          `/today/done?streak=${result.streak.streak_days}&phase=${result.bodyPhase}&total=${result.totalEntries}`,
        );
```

- [ ] **Step 2: typecheck で result の新フィールド参照が解決確認**

Run: `npm run typecheck`
Expected: エラーなし(Task 3 で戻り値拡張済みなので型一致)

- [ ] **Step 3: build で client component として正しく compile**

Run: `npm run build`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add app/today/_components/QuestionFlow.tsx
git commit -m "feat: pass phase + total to /today/done redirect

submitEntry の新戻り値を URL params に転送、done page が BloomMoon に
今日の月相と milestone 判定値を渡せるように。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: done page を BloomMoon + milestone 判定で書き換え

**Files:**
- Modify: `app/today/done/page.tsx`(全体差し替え)

- [ ] **Step 1: done page を BloomMoon 統合版に置き換え**

`app/today/done/page.tsx` の全内容を以下に置換:

```typescript
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BloomMoon, type BloomBurst } from "@/components/BloomMoon";
import { CallbackCard } from "@/components/CallbackCard";
import { selectCallbackEntry } from "@/lib/server-actions/callback";
import { formatDisplay } from "@/lib/utils/date";
import { extractBodyPhase, extractFreeText } from "@/lib/utils/entry";

interface Props {
  searchParams: Promise<{ streak?: string; phase?: string; total?: string }>;
}

// milestone 初到達時のみ burst 発火(ADR-017 stage 同期 5/15/25/35 + 古典 100/365)
const BURST_BY_TOTAL: Record<number, Omit<BloomBurst, "seed">> = {
  5: { count: 3, tier: "small" },
  15: { count: 3, tier: "small" },
  25: { count: 3, tier: "small" },
  35: { count: 3, tier: "small" },
  100: { count: 5, tier: "medium" },
  365: { count: 7, tier: "large" },
};

function clampPhase(raw: string | undefined): 1 | 2 | 3 | 4 | 5 {
  const n = parseInt(raw ?? "5", 10);
  if (n >= 1 && n <= 5) return n as 1 | 2 | 3 | 4 | 5;
  return 5;
}

export default async function DonePage({ searchParams }: Props) {
  const params = await searchParams;
  const streak = parseInt(params.streak ?? "1", 10);
  const phase = clampPhase(params.phase);
  const total = parseInt(params.total ?? "0", 10);

  const burstConfig = BURST_BY_TOTAL[total];
  const burst: BloomBurst | undefined = burstConfig
    ? { ...burstConfig, seed: total }
    : undefined;

  const callback = await selectCallbackEntry();

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="px-6 py-12 max-w-md mx-auto">
        <div className="text-center space-y-8">
          <div className="mx-auto">
            <BloomMoon phase={phase} burst={burst} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900">
              今日もありがとう
            </h1>
            <p className="text-neutral-600">
              また明日、待ってます
            </p>
          </div>

          <div className="rounded-2xl bg-primary-50 border border-primary-100 p-6">
            <p className="text-sm text-neutral-600">灯した夜</p>
            <p className="text-4xl font-bold text-primary-600 mt-1">
              {streak}
              <span className="text-lg ml-1 font-medium">つ</span>
            </p>
          </div>

          {callback && (
            <CallbackCard
              dateLabel={formatDisplay(callback.entry.entry_date)}
              bodyPhase={extractBodyPhase(callback.entry)}
              entryText={extractFreeText(callback.entry)}
              stageLabel={callback.label}
            />
          )}

          <Link
            href="/calendar"
            className="block w-full rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            これまでのほしふみを見る
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: typecheck で BloomMoon 統合の型整合確認**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: build で /today/done が ƒ(dynamic)として生成確認**

Run: `npm run build`
Expected: success、`/today/done` の行が表示される

- [ ] **Step 4: Commit**

```bash
git add app/today/done/page.tsx
git commit -m "feat: integrate BloomMoon into /today/done with milestone burst

固定 phase=5 のヒーロー月相を今日の Q1 phase に置換、bloom + glow 演出。
URL params (phase / total) から milestone (5/15/25/35/100/365) 判定で burst 発火。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 手動 smoke テスト(dev サーバー)

**Files:** なし(動作確認のみ)

- [ ] **Step 1: dev サーバー起動**

Run: `npm run dev`
Expected: `▲ Next.js 16.x ... Ready in 〜ms` 表示、http://localhost:3000

- [ ] **Step 2: ローカル本番 Supabase を使う設定確認**

`.env.local` を確認、`NEXT_PUBLIC_SUPABASE_URL=https://uytlmbhkxtgdvazhvjxy.supabase.co` で remote 本番に接続(現状この設定)。Magic Link or Google でログイン可能なはず。

- [ ] **Step 3: 通常 bloom 動作確認(entry 1個目 〜 milestone 未満)**

1. http://localhost:3000/today を開く
2. Q1 で MoonPhase phase 3(or 任意)タップ → Q2 自由記述 → Q3 自由記述 → 保存
3. `/today/done` 着地時に:
   - [ ] ヒーロー月相が scale 0→1 で bloom(1.5秒)
   - [ ] bloom 完了後 glow が呼吸開始(3秒周期)
   - [ ] 月相は Q1 で選んだ phase(固定 phase 5 ではない)
   - [ ] callback card は出ない(entry < 5)

- [ ] **Step 4: milestone burst 動作確認(entry 5/15 等)**

総 entry 数が milestone に達するように複数日に分けて submit するのは時間かかるので、**seed SQL で擬似**:

```bash
# 既存 scripts/seed-callback.sql を改造、または以下を直接実行
psql "$(supabase status -o env | grep ^DB_URL | cut -d= -f2-)" <<SQL
-- 自分の user_id を取って 4 つ過去エントリを seed、続いて今日の submit で entry=5 が成立
-- scripts/seed-callback.sql 参照
SQL
```

実際は local supabase ではなく remote 本番 DB に向けて作業しているため、本番に test data 入れたくなければ:
- Option A: 残りの test は本番自然 entry で確認(時間かかる)
- Option B: 一時的に local supabase に切り替えて test、終わったら本番に戻す

ここでは **Option A 推奨**:Phase 0 本番運用が始まってるので、entry 5 到達した日に burst を実機確認。それ以降の milestone は long-term 観察。

- [ ] **Step 5: reduced-motion 動作確認**

macOS:
1. System Settings → Accessibility → Display → **Reduce motion** を ON
2. ブラウザ reload `/today/done`
3. [ ] bloom なし、月相は最初から完全表示
4. [ ] glow なし、static
5. [ ] burst 該当時でも small light 出ない
6. 確認後 Reduce motion OFF に戻す

- [ ] **Step 6: dev サーバー停止**

`Ctrl+C` で dev サーバー終了

---

## Task 7: WORLDVIEW.md / MOTION.md に新 motion カテゴリ追記

**Files:**
- Modify: `docs/MOTION.md`(YES list 拡張)
- Modify: `docs/WORLDVIEW.md`(YES list 拡張、Motion セクション)

- [ ] **Step 1: docs/MOTION.md の YES list に bloom と glow-pulse を追加**

`docs/MOTION.md` の「使う motion」表に以下行を追加(具体的位置は doc 先頭の表 or 該当セクション、追加箇所は doc 既存構造に合わせる):

```markdown
| **bloom** | scale 0→1 + opacity 0→1 | 1500ms / cubic-bezier(0.16, 1, 0.3, 1) | 新しい要素が「現れる」(BloomMoon ヒーロー、milestone 中心月) | once、ループしない |
| **glow-pulse** | box-shadow blur radius が breath | 3000ms / ease-in-out infinite | bloom 完了後の月相を「灯」感で持続 | 控えめな amber blur(rgba(245,212,154,0.25 〜 0.4))|
| **fade-in-soft (scale 0.6→1)** | opacity 0→1 + scale 0.6→1 | 800ms / ease-out | milestone burst の small light 個別発生 | 100ms 間隔で stagger |
```

α 厳格(slide / bounce / spring 不可)原則は維持。bloom は scale を使うが「one-time appear」で位置移動なしのため、worldview の「fade extended」として許容。

- [ ] **Step 2: docs/WORLDVIEW.md のモーションセクションに参照追加**

`docs/WORLDVIEW.md` の「モーション」セクション(既に MOTION.md への link 化済み)に1行補足:

> 2026-05-18 追記:ADR-019 のため、`BloomMoon` で **bloom**(scale 0→1 + opacity 0→1、one-time)と **glow-pulse**(box-shadow breath、infinite)を採用。MOTION.md の YES list 参照。

- [ ] **Step 3: Commit**

```bash
git add docs/MOTION.md docs/WORLDVIEW.md
git commit -m "docs: add bloom / glow-pulse / fade-in-soft to WORLDVIEW / MOTION YES list

BloomMoon (ADR-019, Star bloom spec) で採用した motion を明文化。
slide / bounce / spring 禁止原則は維持、bloom は 'fade extended' として許容。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: NEXT-ACTIONS に新項目追記 + push 一括

**Files:**
- Modify: `docs/NEXT-ACTIONS.md`

- [ ] **Step 1: NEXT-ACTIONS の Phase 0 セクションに「Star Bloom 実装完了」を追記**

`docs/NEXT-ACTIONS.md` の 🌒 Phase 0 セクション「Phase 0 着手前の最小実装」配下に以下を追加(callback 実装行の下、適切な位置):

```markdown
- [x] ~~**Star Bloom on /today/done 実装**~~ **2026-05-18 完了** ─ ヒーロー月相を今日の Q1 phase に置換、bloom + glow + milestone burst(5/15/25/35/100/365)演出。spec: `docs/specs/2026-05-18-star-bloom-on-done-design.md`、plan: `docs/plans/2026-05-18-star-bloom-on-done.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/NEXT-ACTIONS.md
git commit -m "docs: mark Star Bloom 実装完了 in NEXT-ACTIONS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: push 全 commit(user 認可要)**

main への push は autonomy mode classifier が block するので、user に明示認可を依頼してから:

```bash
git push origin main
```

push 完了後、Vercel に GitHub integration が無いので **手動再デプロイ**:

```bash
vercel --prod --yes
```

production の新 deploy URL を確認、`https://hoshifumi.vercel.app` で bloom 演出が動くか実機確認。
