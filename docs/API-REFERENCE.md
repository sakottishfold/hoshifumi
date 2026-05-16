# API リファレンス

> Claude Code が既存の関数を素早く調べるためのリファレンス。
> 最終更新: 2026-05-16(ADR-011〜019 反映済み。AI follow-up (ADR-012) と past-entry callback (ADR-017) は未実装)

## Server Actions

### `lib/server-actions/entries.ts`

#### `submitEntry(input)`
```typescript
async function submitEntry(input: {
  date?: string;          // YYYY-MM-DD, defaults to today JST
  bodySensation: number;  // 1-5 (Q1, was `mood` pre-ADR-013)
  freeText: string;       // Q2
  tomorrowMessage: string; // Q3 (free text, was short_choice pre-ADR-014)
}): Promise<{
  success: true;
  entryId: string;
  streak: { streak_days: number; longest_streak: number };
}>
```
今日のエントリを作成または更新。3つの answers を全部置き換え。streak を再計算。

#### `getEntryByDate(date)`
```typescript
async function getEntryByDate(date: string): Promise<EntryWithAnswers | null>
```
1日分のエントリを answers 付きで取得。

#### `getEntriesForMonth(year, month)`
```typescript
async function getEntriesForMonth(
  year: number,
  month: number
): Promise<EntryWithAnswers[]>
```
カレンダー月内の全エントリを answers 付きで取得。

#### `selectCallbackEntry()`(v1.0 で実装予定)
```typescript
async function selectCallbackEntry(): Promise<{
  entry: EntryWithAnswers;
  label: string;   // 例:「数日前のあなた」「ひと月前のあなた」「1年前のあなた」
} | null>
```
`/today/done` から呼び出される。今 callback を出すか、出すなら何のエントリ + ラベルを返すか決める。詳細は SPEC §8(ADR-017)。

### `lib/server-actions/auth.ts`

#### `sendMagicLink(formData)`
```typescript
async function sendMagicLink(formData: FormData): Promise<{
  success?: true;
  error?: string;
}>
```
Magic Link メールを送信。フォームに `email` フィールド必須。

#### `signOut()`
```typescript
async function signOut(): Promise<void>  // /login にリダイレクト
```

## ユーティリティ

### `lib/utils/date.ts`

```typescript
function todayJST(): string           // 'YYYY-MM-DD' を返す
function parseDateJST(dateStr: string): Date
function formatDisplay(dateStr: string): string  // '5月10日(土)'
function monthRange(year: number, month: number): { start: string; end: string }
function getDaysInMonth(year: number, month: number): string[]
```

### `lib/utils/streak.ts`

```typescript
async function updateStreakForUser(userId: string): Promise<{
  streak_days: number;
  longest_streak: number;
}>
```
直近365件のエントリから streak を再計算。`profiles` テーブルを更新。

### `lib/utils/cn.ts`

```typescript
function cn(...inputs: ClassValue[]): string  // tailwind-merge + clsx
```

## Supabase クライアント

### `lib/supabase/server.ts`

```typescript
async function createClient(): Promise<SupabaseClient>
```
Server Components と Server Actions で使う。セッションクッキーの読み書き対応。

### `lib/supabase/client.ts`

```typescript
function createClient(): SupabaseClient
```
Client Components で使う。

### `lib/supabase/middleware.ts`

```typescript
async function updateSession(request: NextRequest): Promise<NextResponse>
```
`proxy.ts`(Next.js 16 で `middleware.ts` から改名)から呼ばれ、セッションを更新し、ルートをガードする。

## 型

### `lib/types.ts`

```typescript
type InputType = "mood_5" | "scale_5" | "rating_4" | "short_choice" | "free_text";

interface MoodOption {
  value: number;
  emoji: string;
  label: string;
}

interface Question {
  position: 1 | 2 | 3;
  text: string;
  input_type: InputType;
  placeholder?: string;
  options?: MoodOption[] | string[];
}

interface Template {
  name: string;
  emoji: string;
  description: string;
  questions: Question[];
}

interface Entry {
  id: string;
  user_id: string;
  entry_date: string;            // YYYY-MM-DD
  template_name: string;
  completed_at: string | null;
  created_at: string;
}

interface Answer {
  id: string;
  entry_id: string;
  question_position: 1 | 2 | 3;
  value_number: number | null;
  value_text: string | null;
  value_choice: string | null;
}

interface EntryWithAnswers extends Entry {
  answers: Answer[];
}

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  notification_time: string;     // 'HH:MM:SS'
  notification_enabled: boolean;
  timezone: string;
  plan: "free" | "pro" | "premium";
  streak_days: number;
  longest_streak: number;
  last_entry_at: string | null;
}
```

## 定数

### `lib/constants/template.ts`

```typescript
const BODY_SENSATION_OPTIONS: MoodOption[];  // 身体感覚 5択 (ADR-013 で MOOD_OPTIONS から改名)
const BASIC_TEMPLATE: Template;              // デフォルトテンプレート
```

## コンポーネント

### `components/AppHeader.tsx`

```typescript
async function AppHeader(): Promise<JSX.Element | null>
```
スティッキーヘッダー。ロゴ(三日月 SVG)、streak バッジ、calendar / settings リンク。未認証なら何も描画しない。

### `components/MoonPhase.tsx`

```typescript
interface Props {
  phase: number; // 1-5 想定、範囲外は clamp
  className?: string;
}
function MoonPhase(props: Props): JSX.Element
```
月相アイコンを SVG で描画。phase 1=新月(outline) / 2=三日月 / 3=上弦(rect mask で真半分) / 4=十三夜 / 5=満月(full disc)。色は固定で `#f5d49a`(amber)。

### `components/CallbackCard.tsx`

```typescript
interface Props {
  dateLabel: string;              // 例: "5月12日(月)"
  bodyPhase?: 1 | 2 | 3 | 4 | 5;  // optional, falsy なら body アイコン非表示
  entryText: string;              // Q2 自由記述、verbatim
  stageLabel: string;             // 例: "数日前のあなた"
}
function CallbackCard(props: Props): JSX.Element
```
ADR-017 の past-entry callback カード。`/today/done` で `selectCallbackEntry()` の結果を表示するために使う。引用係原則(ADR-016)準拠:エントリ本文を verbatim で表示、AI コメント追加しない。

**Contract (Contract-clear pattern)**:caller MUST pre-filter entries with empty `entryText`。コンポーネントは caller を trust、defensive return null は入れない。

**Narrow props (Narrow props pattern)**:`EntryWithAnswers` の domain entity を直接受け取らず、レンダリングに使うフィールドのみ。`selectCallbackEntry()` の return を adapter で変換するのは callsite の責務。これにより component が ADR-012 schema migration 等の future change から decouple される。

Style: highlight card pattern(`rounded-2xl bg-primary-50 border border-primary-100 p-6`)準拠、既存 streak card / QuestionFlow review preview と統一。

### `app/today/_components/QuestionFlow.tsx`

```typescript
interface Props {
  initialEntry: EntryWithAnswers | null;
  date: string;          // YYYY-MM-DD
  displayDate: string;   // '5月10日(土)'
}
function QuestionFlow(props: Props): JSX.Element
```
日次儀式フローのコントローラ。質問を1問ずつレンダー、確認画面、送信。

### `app/today/_components/MoodInput.tsx`

```typescript
interface Props {
  value: number | null;
  onChange: (value: number) => void;
  options: MoodOption[];
}
```
5タップ選択 UI。MoonPhase コンポーネントで各 phase を描画。

### `app/today/_components/FreeTextInput.tsx`

```typescript
interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

### `app/today/_components/ProgressDots.tsx`

```typescript
interface Props {
  current: number;       // 0-indexed
  total: number;
}
```

### `app/calendar/_components/CalendarGrid.tsx`

```typescript
interface Props {
  year: number;
  month: number;
  entries: EntryWithAnswers[];
}
```
月グリッド。エントリがある日に MoonPhase で身体感覚を表示。

## ルート(file → URL)

| ファイル | URL | 認証要 |
|---|---|---|
| `app/page.tsx` | `/` | 認証状態でリダイレクト |
| `app/login/page.tsx` | `/login` | 不要 |
| `app/auth/callback/route.ts` | `/auth/callback` | 不要 |
| `app/today/page.tsx` | `/today` | 必要 |
| `app/today/done/page.tsx` | `/today/done` | 必要 |
| `app/calendar/page.tsx` | `/calendar` | 必要 |
| `app/calendar/[date]/page.tsx` | `/calendar/YYYY-MM-DD` | 必要 |
| `app/settings/page.tsx` | `/settings` | 必要 |
| `app/manifest.ts` | `/manifest.webmanifest` | 不要 |

## 環境変数

| 変数 | 使用箇所 | 必須 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 全 Supabase クライアント | 必須 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 全 Supabase クライアント | 必須 |
| `SUPABASE_SERVICE_ROLE_KEY` | v1.0+ AI follow-up / v1.1+ cron jobs | v0 では不要 |
| `ANTHROPIC_API_KEY` | v1.0+ AI follow-up / v1.1+ 月次レポート | v0 では不要 |
| `NEXT_PUBLIC_SITE_URL` | 認証リダイレクト | 必須 |
