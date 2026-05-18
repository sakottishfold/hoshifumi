# 過去日ジャーナル作成・編集 ─ Design

> Status: **承認待ち**(オーナーレビュー後 writing-plans へ)
> 日付: 2026-05-18
> Issue: `issues/2026-05-18-past-date-journal-entry.md` (#001)
> 関連: ADR-008(streak 罰しない)/ ADR-017(callback γ stage)/ ADR-019(worldview)
> ブレスト履歴: 本セッション 2026-05-18

---

## 1. Overview

`/calendar/[date]` を **read-only から write-capable に拡張**し、過去日 / 今日いずれも entry の作成・編集ができる動線を追加する。入力 UI は既存 `QuestionFlow` をそのまま再利用(`date` + `initialEntry` props 経由)。今日 submit は既存通り `/today/done` で bloom + callback ceremony、過去 submit は `/calendar/[date]` に detail 着地で quiet 確認に分岐。

未来日は server で拒否、streak は retroactive update(既存 `updateStreakForUser` の自動挙動)、callback unlock 判定を `===` から `>=` に修正して遡及踏み越えを次の /today/done でキャッチアップ。Star Bloom milestone burst は silent retroactive(live ritual 専用、追わない)。

---

## 2. Context と決定の経緯(ブレスト要約)

| 決定点 | 採用 | 理由 |
|---|---|---|
| 遡及範囲 | **a. 制限なし** | worldview「夜空に星が積もる」と整合、UX 柔軟、実装コスト不変 |
| submit 後の遷移 | **d. mode 依存**(今日→/today/done、過去→/calendar/[date]) | ceremony は live ritual 限定、過去は静か。「今日が特別」を保つ |
| streak 影響 | **a. retroactive update** | ADR-008(罰しない)と整合、updateStreakForUser 既存挙動で自動 |
| callback milestone | **β. `>=` 判定で次 /today/done キャッチアップ** | 1行変更、遡及踏み越えに気づいてくれる、UX 公正 |
| Star Bloom milestone burst | **α. silent retroactive** | burst は live ritual のご褒美、追わない、DB 状態 track 追加せず |
| グリフ / コピー | 既存 trust、verb は plain「書く」 | worldview metaphor は noun(「ほしふみ」「灯した夜」)で十分 |

---

## 3. User Experience

### 3.1 mode A: 空欄(過去 or 今日)

`/calendar/[date]` で対象日に entry が無い:

```
[AppHeader]
[← カレンダーへ戻る]

5月14日(Wed)

┌─────────────────┐
│ この日の記録は      │
│ ありません          │
│                   │
│ [この日のほしふみを書く] │  ← 新規 button
└─────────────────┘
```

- 過去日:button = `?edit=1` に遷移して mode C へ
- 今日:既存「今日のほしふみを書く」link を `?edit=1` 版に書き換え(動線は本ページ内で完結、`/today` へ抜けない選択も可能)

(注:`/today` route は別エントリポイントとして維持、互換性のため今日へのリンクを切らない)

### 3.2 mode B: 既存 entry あり

既存の `EntryDetail` 表示 + 下部に「書き直す」button 追加:

```
[AppHeader]
[← カレンダーへ戻る]

5月14日(Wed)

[いまの体の感じ:◌ ふつう]
[今日いちばん印象に残ったこと:夕方の散歩で…]
[明日の自分にひとことだけ:本を1ページ読む]

記録日時: 2026/05/14 22:31

[書き直す]  ← 新規 button
```

button tap で `?edit=1` 遷移 → mode C へ。

### 3.3 mode C: 入力モード(QuestionFlow render)

`/calendar/[date]?edit=1` で同 page 内に QuestionFlow 表示:

```
[AppHeader]
[← {M月d日(E)}のほしふみ をやめる]  ← cancel link、?edit=1 解除

5月14日(Wed)のほしふみ

[ProgressDots 1/3]
1つめ
いまの体の感じは?
[MoodInput 5タップ]
[つぎへ]
```

QuestionFlow を today 版とまったく同じコンポーネントで render、props は:
- `date={date}` ─ 対象日(URL params 由来)
- `initialEntry={entry}` ─ 既存 entry あれば prefill、なければ null
- `displayDate={formatDisplay(date)}` ─ ヘッダー表示用

submit 完了後、QuestionFlow が分岐:
- `date === todayJST()` → `/today/done?streak=N&phase=P&total=M`(既存 today 動線、bloom + callback ceremony)
- それ以外 → `/calendar/{date}`(mode B detail に戻る、ceremony なし、saved entry を確認)

### 3.4 未来日

`/calendar/[date]` で date > todayJST():
- mode A 表示なしで「未来は書けません」message + 戻る link
- `?edit=1` を直接叩いても server validation で拒否

### 3.5 retroactive milestone catch-up

シナリオ例:
```
現状 entries = 4, profiles.unlocked_stage = 0
過去日を /calendar/[date]?edit=1 で書いた → entries = 5
/calendar/[date] detail mode に着地 → ceremony なし、unlocked_stage は 0 のまま

翌日今日の submit → /today/done 着地
selectCallbackEntry 実行: entryCount = 6, unlockAt = 5
旧コード(=== 判定): 6 !== 5 → Stage 1 永遠に発火しない bug
新コード(>= 判定): 6 >= 5 && 1 > 0 → Stage 1 deterministic 発火、unlocked_stage = 1 に bump
→ user は「翌日の今夜、callback がやってきた」体験を得る
```

Star Bloom burst は同じシナリオで:
- URL `?total=6` で render
- `BURST_BY_TOTAL[6]` = undefined → burst なし
- → 5 を踏み越えた瞬間に burst は出ないが、burst は live ritual の祝いと割り切る、silent

---

## 4. Architecture

### 4.1 修正ファイル

| ファイル | 変更内容 |
|---|---|
| `app/calendar/[date]/page.tsx` | read-only → 3 mode(空欄 / detail / 編集)対応、`?edit=1` で QuestionFlow render、未来日 reject |
| `app/today/_components/QuestionFlow.tsx` | `handleSubmit` の redirect 先を `date === todayJST()` で分岐 |
| `lib/server-actions/entries.ts` | `submitEntry` 冒頭で future date validation 追加 |
| `lib/server-actions/callback.ts` | `selectCallbackEntry` の unlock 判定を `=== unlockAt` から `>= unlockAt` に変更 |
| `issues/2026-05-18-past-date-journal-entry.md` | status: open → in-progress(着手時)、最終的に closed(完了時) |

### 4.2 既存コードへの影響

- `app/today/page.tsx`: **変更なし**(今日専用エントリポイント維持)
- `app/calendar/page.tsx`(月 grid): **変更なし**(grid cell tap で /calendar/[date] へ既存遷移)
- `components/CalendarGrid` 等: **変更なし**
- `components/BloomMoon` / `components/CallbackCard`: **変更なし**
- `lib/utils/streak.ts`: **変更なし**(既に retroactive 対応、JST fix 済み)

---

## 5. Data Flow

### 5.1 mode 判定(server component)

```typescript
// app/calendar/[date]/page.tsx 擬似コード
const { date } = await params;
const editing = (await searchParams).edit === "1";
const today = todayJST();

if (!isValidDateFormat(date)) notFound();

if (date > today) {
  return <FutureDateMessage date={date} />;
}

const entry = await getEntryByDate(date);

if (editing) {
  return <QuestionFlow date={date} initialEntry={entry} displayDate={formatDisplay(date)} />;
}

if (!entry) {
  return <EmptyMode date={date} />; // mode A
}

return <DetailMode entry={entry} date={date} />; // mode B
```

### 5.2 QuestionFlow 分岐 redirect

```typescript
// app/today/_components/QuestionFlow.tsx handleSubmit
startTransition(async () => {
  const result = await submitEntry({ date, bodySensation, freeText, tomorrowMessage });
  if (!result.success) return;

  const target = date === todayJST()
    ? `/today/done?streak=${result.streak.streak_days}&phase=${result.bodyPhase}&total=${result.totalEntries}`
    : `/calendar/${date}`;
  router.push(target);
});
```

### 5.3 submitEntry future date reject

```typescript
// lib/server-actions/entries.ts submitEntry 冒頭
const entryDate = input.date ?? todayJST();
if (entryDate > todayJST()) {
  throw new Error("未来日は書けません");
}
```

(以降の処理は既存通り、upsert + answers + updateStreakForUser + count query + return)

### 5.4 selectCallbackEntry retroactive catch-up

```typescript
// lib/server-actions/callback.ts STEP 4 内
const unlockingStage = STAGES.find(
  (s) => entryCount >= s.unlockAt && s.stage > unlockedStage,  // === から >= へ
);
```

挙動の変化:
- 旧:entryCount が unlockAt と完全一致した瞬間にしか発火しない
- 新:unlockAt を踏み越えた状態であれば、次の /today/done で「未消化の最低 stage」が deterministic 発火
- 副作用なし(`s.stage > unlockedStage` で1回しか fire しない既存ガードが効く)

---

## 6. Error Handling

| ケース | 挙動 |
|---|---|
| 不正な date format(YYYY-MM-DD 以外)| `notFound()`(既存) |
| date > todayJST()(未来日 GET) | mode A 出さず「未来は書けません」message + 戻る link |
| date > todayJST()(submitEntry POST) | server で `throw new Error("未来日は書けません")`、QuestionFlow の既存 error UI に流れる |
| `?edit=1` だが未認証 | proxy(middleware)が既存通り /login へ |
| network error during submit | 既存 QuestionFlow error handling |
| 同時編集(別タブ等) | last-write-wins、無視(scope 外) |
| `?edit` 値が `"1"` 以外 | falsy 扱いで detail mode、無視 |

---

## 7. Implementation Scope

### In scope(v1.0、本 design)

- `/calendar/[date]` の 3 mode 化(空欄 / detail / 編集)
- `?edit=1` query param で編集モード切替
- QuestionFlow の redirect 分岐(date === todayJST 判定)
- submitEntry の future date reject(server-side validation)
- selectCallbackEntry の `>=` 判定変更(retroactive callback catch-up)
- 未来日アクセス時の専用 message
- `issues/...` を in-progress → closed lifecycle

### Out of scope(明示)

- Star Bloom milestone burst の retroactive catch-up(α 維持、silent、burst は live ritual 専用)
- 「未来日を書ける」機能(明示拒否)
- 編集履歴 / version 管理(過去版を残す機能)
- 同時編集 lock / conflict resolution(last-write-wins)
- 「過去日まとめ書き」UI(複数日を1画面で連続入力する機能、scope 外)
- 「N日前の記憶を促す」hint UI(将来 backlog)
- 編集回数制限 / 編集禁止 lock(将来 backlog)

---

## 8. Testing

CLAUDE.md「v0 はテストなし、v1.0 launch 前に Playwright 導入」方針に従い、**自動テストなし**。

手動 smoke:
- [ ] /calendar/[date] で空欄日(過去)→「この日のほしふみを書く」tap → 入力 UI 表示
- [ ] 入力 → submit → /calendar/[date] に detail として着地、ceremony なし
- [ ] 同日に「書き直す」tap → 既存値 prefill された QuestionFlow → 編集 → submit → detail に新値で着地
- [ ] /calendar/[date] で今日 → 既存挙動と同等(/today への link は維持)
- [ ] 今日を /calendar/[date]?edit=1 で submit → /today/done に着地、bloom + callback 動作
- [ ] /calendar/[date] で未来日 → 「未来は書けません」message、書けない
- [ ] `?edit=1` 直接アクセスでも未来日は server reject(UI で error)
- [ ] streak が retroactive で正しく再計算(空欄日を埋めて連続性確立 → streak 伸びる)
- [ ] callback retroactive:entries=4 → 過去日埋めて 5 → /today/done で Stage 1 deterministic 発火確認

---

## 9. Open Questions(設計時点、実装中に解消)

- mode C 入力中の cancel UX:
  - 「やめる」link は `?edit=1` 解除で mode B/A に戻るが、未保存変更があったときの confirm dialog 出すか? → MVP は出さない、failure mode は最後の入力が消えるだけ(UX 摩擦低い)
- mode B「書き直す」のボタン文言と既存「修正する」(QuestionFlow 確認画面内)の整合:
  - 完全に同じ「修正する」に揃えるか、外と内で「書き直す / 修正する」と差をつけるか
  - 実装時に並べて目視で決定
- /calendar/[date] mode A の「書く」を /today への link 化することも検討した(過去日のみ ?edit=1)が、今日も /calendar 内で完結する方が動線シンプル → 両方 `?edit=1` 統一
- 未来日 message のコピー文言:「未来は書けません」or「明日のことは明日に」or「未来の星はまだ灯せません」? worldview tone で決める

---

## 10. References

- ブレスト履歴:本セッション 2026-05-18
- issue:`issues/2026-05-18-past-date-journal-entry.md`(#001)
- ADR-008:streak 罰しない原則
- ADR-017:callback γ stage モデル(unlock 判定 `>=` 修正対象)
- ADR-019:worldview canonical decision
- 既存コード:`app/today/_components/QuestionFlow.tsx`(再利用)、`app/today/page.tsx`(参考、変更なし)、`lib/server-actions/entries.ts`、`lib/server-actions/callback.ts`、`lib/utils/streak.ts`(既に retroactive 対応)
