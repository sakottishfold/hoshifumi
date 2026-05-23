# テンプレートをユーザー設定にする ─ Design

> Status: **実装完了**(2026-05-23)
> 日付: 2026-05-23
> 関連 ADR: ADR-019(worldview)/ **ADR-025(新規・要起票)**
> 関連 spec: `docs/specs/2026-05-21-additional-templates-design.md` ── 本 spec はその §7.1「inline switcher」を覆す
> ブレスト履歴: 本セッション 2026-05-23

---

## 1. Overview

テンプレート機能を「エントリごとに `/today` 上の inline ピルで選ぶ」モデルから、「ユーザー単位の設定。初回 onboarding で1回選び、以降は設定画面で変更」モデルへ変更する。

起点:オーナーのセルフテスト所感 ──「テンプレート機能がある部分がわかりにくすぎる」。`/today` step 0 に出る小さな灰色ピル(`ほしふみ ▾`)は、存在に気づけず・押せると思えない。テンプレは毎晩選び替えるものではなく、その人の日記の「ジャンル」── 一度決めたら基本そのまま、というのが自然な使われ方。

| # | 変更 |
|---|---|
| 1 | テンプレをユーザー単位の設定に(`profiles.template_name` 新設) |
| 2 | onboarding(新規)で初回に1回ジャンルを選ぶ |
| 3 | 設定画面で変更可能にする |
| 4 | `/today` から inline switcher を撤去 |
| 5 | basic テンプレの表示名「ほしふみ」→「きほん」に改名 |

---

## 2. 背景・経緯(ブレスト要約)

| 決定点 | 採用 | 理由 |
|---|---|---|
| テンプレの粒度 | エントリごと → **ユーザー単位** | テンプレは「日記のジャンル」。毎晩選び替えるものではない。一度決めて基本固定が自然 |
| 選ぶタイミング | 初回登録時(onboarding) | 「最初にどのジャンルの日記を書きたいか選ぶ」── オーナーの言葉どおり |
| 変更口 | 設定画面 | ジャーナル画面(`/today`)に変更 UI は不要。inline ピルは気づけないので撤去 |
| onboarding の形 | 専用画面・1枚・5択タップ・即完了 | ウィザードにしない。儀式の穏やかさ(ADR-019)を守る |
| `entries.template_name` | 残す | エントリごとの「どのテンプレで書いたか」の記録。後でテンプレを変えても過去エントリの Q2 ラベルは当時のまま(`EntryDetail` がそう読む) |
| basic の表示名 | 「ほしふみ」→「きほん」 | アプリ名と同じで、選択肢に並ぶと混乱する |

---

## 3. モデル変更

**変更前:** テンプレはエントリ単位。`/today` step 0(新規時のみ)の `TemplateSwitcher` で毎回選べ、`getLastUsedTemplate()` で前回値が sticky に引き継がれる。`submitEntry` が `templateName` を受け `entries.template_name` に保存。

**変更後:** テンプレはユーザー単位の設定 `profiles.template_name`。

- 新規ユーザー:profile 作成時 `template_name` = NULL(= onboarding 未完了)。初回 `/today` 訪問で `/onboarding` へ誘導、ジャンルを選ぶと `profiles.template_name` が埋まる。
- 以降:`/today` は常に `profiles.template_name` のテンプレで開く。変更は設定画面のみ。
- `entries.template_name` は引き続きエントリごとに保存(submit 時に `profiles.template_name` を焼き込む)。テンプレを後で変えても過去エントリは当時のテンプレのまま表示される。

---

## 4. データモデル / migration

### 4.1 スキーマ変更

`profiles` に `template_name` を追加(nullable・default なし)。

```sql
-- supabase/migrations/2026XXXXXXXXXX_profile_template.sql
alter table profiles
  add column template_name text;

comment on column profiles.template_name is
  'ユーザーが選んだ日記テンプレ。NULL = onboarding 未完了(初回テンプレ選択前)。';

-- 既存 profile を backfill:直近エントリのテンプレ、無ければ basic。
-- これにより既存ユーザー(オーナー)は onboarding 画面を踏まずに済む。
update profiles p
set template_name = coalesce(
  (select e.template_name from entries e
   where e.user_id = p.id
   order by e.entry_date desc limit 1),
  'basic'
)
where p.template_name is null;
```

- **nullable・default なし** が重要 ── profile 自動作成 trigger(`insert into public.profiles (id, email)`)は `template_name` を指定しないので、新規 profile は NULL になる。この NULL が「onboarding 未完了」の signal。`default 'basic'` にすると「未完了」と「basic を選んだ」が区別できなくなるため default は付けない。
- CHECK 制約は付けない(`entries.template_name` も CHECK なし。テンプレ名は TS 定数で管理、不明値は `getTemplate()` が basic にフォールバック)。
- RLS:`profiles` は既存ポリシー(本人のみ select/update)で `template_name` もカバーされる。追加不要。

### 4.2 `lib/types.ts`

`Profile` interface に `template_name: string | null;` を追加。

---

## 5. Onboarding(新規)

### 5.1 ルートと誘導

- 新ルート:`app/onboarding/page.tsx`(server component)。
- 誘導:`app/today/page.tsx`(server component)が profile を読み込む際、`template_name` が NULL なら `redirect("/onboarding")`。
- `app/onboarding/page.tsx` は逆に `template_name` が設定済みなら `redirect("/today")`(onboarding 済みユーザーが URL 直打ちで来ても弾く)。
- root(`app/page.tsx`)は変更なし(user → `/today` のまま。`/today` 側のガードが onboarding 判定を担う)。proxy / middleware には判定を載せない(毎リクエストの DB 読みを避ける)。

### 5.2 画面

1画面。構成:

```
[AppHeader なし、または最小]

  どんな夜を綴る?            (見出し、軽い1行)
  あとから設定で変えられる    (補助コピー、text-sm text-neutral-500)

  ┌────────────────────────────┐
  │ きほん    ジャンルを決めずに… │  ← TemplatePicker(5択)
  │ 仕事      仕事の一日を置く     │
  │ 子育て    子どもとの一日を…    │
  │ つくる    つくる一日を置く     │
  │ 感謝      ありがたみを置く     │
  └────────────────────────────┘
```

- カードを1つタップ → `setTemplate(name)` server action → `/today` へ redirect。「次へ」ボタンなし、確認ステップなし。
- 1タップで完了する穏やかな所作にする(ADR-019)。

---

## 6. 設定画面

`app/settings/page.tsx`(server component)に「テンプレート」カードを追加。

- 既存の `SettingsCard` の並びに「日記のテンプレート」カードを足す。アカウント/灯した夜カードと同列。
- 現在のテンプレの `displayName` + `description` を表示。タップでその場に5択(`TemplatePicker`)を inline 展開 ── 設定画面全体がカード UI なので、別ページ遷移ではなく inline 展開で統一する。
- 選択 → `setTemplate` server action → 表示更新。
- 設定でテンプレを変えても過去エントリには影響しない(`entries.template_name` は焼き込み済み)。次に書くエントリから新テンプレが適用される。

---

## 7. `/today` からの switcher 撤去

- `app/today/_components/TemplateSwitcher.tsx` を**削除**。
- `app/today/_components/QuestionFlow.tsx`:
  - `TemplateSwitcher` の import と step 0 での render を撤去。
  - `templateName` の `useState` / `setTemplateName` を撤去。テンプレは prop で受け取るだけの値にする(`QuestionFlow` 内で切り替わらない)。
  - `initialTemplateName` prop はそのまま使う(新規は `profiles.template_name`、過去日編集は entry 自身の `template_name` ── 呼び出し側が渡す)。名前は実態に合わせ `templateName` にリネームしてもよい(任意)。
- `app/today/page.tsx`:テンプレ取得元を `getLastUsedTemplate()` から `profiles.template_name` に変更し、`QuestionFlow` に渡す。
- `lib/server-actions/entries.ts`:`getLastUsedTemplate()` を**削除**(sticky 用途が消えるため)。`submitEntry` の `templateName` 引数は現状維持(`QuestionFlow` が prop の値をそのまま渡す)。
- `app/calendar/[date]` 経由の過去日編集:変更なし。過去エントリ自身の `template_name` を `QuestionFlow` に渡す既存挙動のまま。

---

## 8. `TemplatePicker` コンポーネント + server action

### 8.1 `components/TemplatePicker.tsx`(新規・client component)

onboarding と設定で共有する5択リスト。

```typescript
interface Props {
  current: string | null;   // 現在のテンプレ(onboarding では null）
  onSelect: (name: TemplateName) => void;
}
```

- `TEMPLATE_LIST` を map し、各テンプレを `displayName` + `description` のカードで表示。`current` と一致するものに選択マーク。
- 既存 `TemplateSwitcher` の展開後リストの見た目を流用してよい(`displayName` 太字 + `description` グレー + ✓)。ただし onboarding ではより主役級の見せ方(タップ領域大きめ)にする。

### 8.2 `lib/server-actions/profile.ts`(新規)

```typescript
"use server";

export async function setTemplate(templateName: string): Promise<void>;
```

- 認証ユーザーの `profiles.template_name` を更新(RLS 経由、service role 不使用)。
- `revalidatePath("/today")` / `revalidatePath("/settings")`。
- 不明な template 名は受け付けない(`TEMPLATE_LIST` に含まれるか検証、含まれなければ何もしないか throw)。

onboarding 画面・設定画面はこの action を呼ぶ薄い client wrapper を持つ(onboarding は選択後 `/today` へ `router.push`、設定はその場で表示更新)。

---

## 9. 命名修正

`lib/constants/template.ts` の basic テンプレ:

- `displayName`:「ほしふみ」→「**きほん**」
- `description`:「体・できごと・明日へ」→「**ジャンルを決めずに、ふつうに置く**」(他テンプレの「〜を置く」と粒度を揃える)

注意:`QuestionFlow` 確認カードの見出し `{displayDate}のほしふみ` はハードコード文字列で、テンプレの `displayName` 由来ではない ── 改名の影響を受けない。実装時に `TEMPLATES.basic.displayName` の他参照箇所を grep で確認すること。

---

## 10. ファイル変更一覧

| ファイル | 区分 | 変更 |
|---|---|---|
| `supabase/migrations/2026XXXXXXXXXX_profile_template.sql` | 新規 | `profiles.template_name` 追加 + backfill |
| `lib/types.ts` | 変更 | `Profile.template_name` 追加 |
| `lib/constants/template.ts` | 変更 | basic の displayName / description 改名 |
| `components/TemplatePicker.tsx` | 新規 | 共有の5択ピッカー |
| `lib/server-actions/profile.ts` | 新規 | `setTemplate` server action |
| `app/onboarding/page.tsx` | 新規 | onboarding 画面 + 誘導ガード |
| `app/onboarding/_components/*` | 新規 | onboarding の client wrapper(`TemplatePicker` を使う) |
| `app/today/page.tsx` | 変更 | テンプレ取得を `profiles.template_name` に、NULL なら `/onboarding` へ redirect |
| `app/today/_components/QuestionFlow.tsx` | 変更 | `TemplateSwitcher` 撤去、`templateName` state 撤去 |
| `app/today/_components/TemplateSwitcher.tsx` | 削除 | inline switcher 廃止 |
| `app/settings/page.tsx` | 変更 | 「テンプレート」カード追加 |
| `app/settings/_components/*` | 新規 | 設定画面のテンプレ変更 client wrapper |
| `lib/server-actions/entries.ts` | 変更 | `getLastUsedTemplate()` 削除 |
| `docs/SPEC.md` | 変更 | テンプレ機能の記述を新モデルへ同期 |

---

## 11. ADR

本変更は `docs/specs/2026-05-21-additional-templates-design.md` §7.1 で決めた「`/today` step 0 の inline switcher」モデルを覆す。決定の巻き戻しなので新規 ADR を起票する。

- **ADR-025(番号は起票時に確定、現状最新は ADR-024)**:テンプレートをユーザー単位の設定にする(onboarding 選択 + 設定変更、inline switcher 廃止)
- `docs/DECISIONS.md` は append-only・オーナー管理。本 spec 承認後、ADR-025 の diff をチャットで提案(直接編集しない)。
- 追加テンプレート機能(5テンプレ体制)自体は廃止しない ── 変えるのは「いつ・どこで選ぶか」だけ。

---

## 12. worldview チェック(ADR-019)

- onboarding は1画面・1タップ・即完了。「最初にどんな夜を綴るか決める」穏やかな所作。儀式の前に重いウィザードを挟まない。
- `/today` から操作 UI(ピル)が消え、ジャーナル画面は問いに集中できる。受け身で穏やかな姿勢に沿う。
- 「あとから設定で変えられる」の一言を onboarding に置き、選択のプレッシャーを下げる。

---

## 13. Implementation Scope

### In scope

- §10 の全ファイル変更
- migration の本番適用は deploy 手順に含める

### Out of scope

- テンプレの中身(問いの文言)をユーザーが編集する機能(カスタムテンプレート、v1.1+。今回は「選び替え」のみ)
- onboarding でのテンプレ選択以外のステップ(プロフィール名入力・通知設定など。今回は追加しない)
- 自動テスト(CLAUDE.md 方針どおり手動 smoke のみ)

---

## 14. Testing

CLAUDE.md「v0 はテストなし」方針どおり自動テストなし。手動 smoke + 観察。検証は dev をスキップし Vercel 本番 deploy 後に確認(オーナー方針)。

手動 smoke:
- [ ] 新規ユーザー(`template_name` NULL)→ `/today` アクセス → `/onboarding` に誘導される
- [ ] onboarding でジャンルを1つタップ → `/today` に遷移、選んだテンプレの Q2 が出る
- [ ] onboarding 済みユーザーが `/onboarding` を URL 直打ち → `/today` に弾かれる
- [ ] `/today` に inline ピルが出ない
- [ ] 設定画面に「テンプレート」カードがあり、現在のテンプレが表示される
- [ ] 設定でテンプレを変更 → 次に `/today` で書くと新テンプレの Q2 が出る
- [ ] 設定変更後も過去エントリの Q2 ラベルは当時のテンプレのまま(`/calendar/[date]`)
- [ ] basic テンプレが「きほん」と表示される
- [ ] 既存 profile(オーナー)が backfill 済みで onboarding を踏まない

---

## 15. Open Questions

- **onboarding の見出しコピー**:「どんな夜を綴る?」は仮。実装時に worldview に沿う1案を確定(worldview-keeper 観点)。
- **設定でのテンプレ変更 UI**:inline 展開で確定。展開後の見た目(`TemplateSwitcher` の既存リスト流用)は実装時に Pencil で軽く確認してもよい。
- **onboarding に AppHeader を出すか**:出さない方向(没入感)だが実装時に既存レイアウトとの整合で判断。

---

## 16. References

- ブレスト履歴:本セッション 2026-05-23
- 先行 spec:`docs/specs/2026-05-21-additional-templates-design.md`(§7.1 inline switcher を本 spec が覆す)
- ADR-019:worldview(onboarding の穏やかさ)
- 既存コード:`lib/constants/template.ts`、`app/today/_components/TemplateSwitcher.tsx`・`QuestionFlow.tsx`、`app/settings/page.tsx`、`app/today/page.tsx`、`lib/server-actions/entries.ts`、`supabase/migrations/20260510000000_initial.sql`(profiles テーブル定義)
