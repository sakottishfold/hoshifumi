# プロジェクト構成

> ほしふみのファイル/ディレクトリ構造、各部の役割、依存関係。
> 最終更新: 2026-05-16

---

## システム全体構成

```
┌────────────────────────────────────────────────────────────────┐
│                          ユーザー(PWA on iOS Safari)         │
└─────────────────────┬──────────────────────────────────────────┘
                      │ HTTPS
                      ▼
┌────────────────────────────────────────────────────────────────┐
│                  Next.js 16 (Vercel)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ proxy.ts(認証ガード、旧 middleware.ts)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │ App Router(SSR pages)   │  │ Server Actions             │  │
│  │ - /login, /today,        │  │ - submitEntry              │  │
│  │   /calendar, /settings   │  │ - sendMagicLink, signOut   │  │
│  │ - /today/done            │  │ - getEntryByDate           │  │
│  │ - /calendar/[date]       │  │ - selectCallbackEntry(v1.0)│  │
│  └──────────┬───────────────┘  └─────────┬──────────────────┘  │
└─────────────┼─────────────────────────────┼───────────────────┘
              │                              │
              ▼                              ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│       Supabase                │  │   Anthropic API              │
│  - Postgres(RLS)             │  │  - Claude Sonnet 4.6         │
│  - Auth(Magic Link)          │  │    (月次レポート、v1.1+)     │
│  - Storage(将来)             │  │  - Claude Haiku 4.5          │
└──────────────────────────────┘  │    (日次 AI follow-up、v1.0+)│
                                  └──────────────────────────────┘
```

主要なリクエストフロー詳細は **`docs/SPEC.md` §1**(日次入力 / 月次レポート)参照。

---

## ディレクトリツリー(全体)

```
hoshifumi/                             # 物理フォルダ名(2026-05-16 に mittsu/ から rename)
├── app/                               # Next.js App Router
│   ├── (root pages)
│   │   ├── page.tsx                   # 認証状態でリダイレクト
│   │   ├── layout.tsx                 # Root layout、metadata、viewport
│   │   ├── globals.css                # Tailwind v4 @theme + 全カラー定義
│   │   └── manifest.ts                # PWA manifest
│   │
│   ├── auth/callback/route.ts         # Magic Link コールバック(OAuth エンドポイント)
│   ├── login/page.tsx                 # Magic Link 送信フォーム
│   │
│   ├── today/                         # 日次儀式のメインフロー
│   │   ├── page.tsx                   # /today エントリページ
│   │   ├── done/page.tsx              # /today/done 完了画面(streak、callback 予定地)
│   │   └── _components/               # /today 専用コンポーネント
│   │       ├── QuestionFlow.tsx       # 3問のステップコントローラ
│   │       ├── MoodInput.tsx          # 身体感覚 5タップ(MoonPhase 使用)
│   │       ├── FreeTextInput.tsx      # 自由記述入力
│   │       └── ProgressDots.tsx       # 進捗ドット
│   │
│   ├── calendar/                      # 過去エントリ閲覧
│   │   ├── page.tsx                   # 月グリッド
│   │   ├── [date]/page.tsx            # 1日分の詳細
│   │   └── _components/
│   │       └── CalendarGrid.tsx       # カレンダーのグリッド表示(月相アイコン)
│   │
│   └── settings/page.tsx              # 設定(現状 read-only)
│
├── components/                        # 横断的に使うコンポーネント
│   ├── AppHeader.tsx                  # スティッキーヘッダー(ロゴ、streak、ナビ)
│   └── MoonPhase.tsx                  # 月相 SVG(phase 1-5)、身体感覚表示の共通部品
│
├── lib/                               # ドメインロジック / インフラ
│   ├── types.ts                       # 共有型(Template, Entry, Answer, Profile, etc.)
│   ├── constants/
│   │   └── template.ts                # BASIC_TEMPLATE、BODY_SENSATION_OPTIONS
│   ├── server-actions/                # 全ミューテーション(ADR-003)
│   │   ├── entries.ts                 # submitEntry, getEntryByDate, getEntriesForMonth
│   │   └── auth.ts                    # sendMagicLink, signOut
│   ├── supabase/                      # Supabase クライアント3種
│   │   ├── server.ts                  # Server Components / Server Actions 用
│   │   ├── client.ts                  # Client Components 用
│   │   └── middleware.ts              # proxy.ts から呼ぶセッション更新
│   └── utils/
│       ├── date.ts                    # todayJST, formatDisplay, monthRange 等(全 JST 固定)
│       ├── streak.ts                  # updateStreakForUser
│       └── cn.ts                      # tailwind-merge + clsx ラッパー
│
├── supabase/
│   └── migrations/
│       └── 20260510000000_initial.sql # 初期スキーマ(profiles, entries, answers, RLS)
│
├── public/                            # 静的アセット
│   ├── icon.svg                       # ロゴ master(indigo 背景込み三日月)
│   ├── icon-mark.svg                  # ロゴ(透過背景、UI 内 inline 用)
│   ├── icon-192.png                   # PWA icon(192x192)
│   ├── icon-512.png                   # PWA icon(512x512)
│   ├── apple-touch-icon.png           # iOS ホーム画面(180x180)
│   └── favicon-32.png                 # ブラウザタブ(32x32)
│
├── docs/                              # プロジェクトドキュメント
│   ├── PRD.md                         # プロダクト要件(戦略・ペルソナ・anti-goals)
│   ├── SPEC.md                        # 技術仕様(スキーマ・API・各機能)
│   ├── DECISIONS.md                   # ADR(19本、決定の歴史)
│   ├── ROADMAP.md                     # バージョン別スコープ(v0/Phase 0/v1.0/v1.1+)
│   ├── DEPLOYMENT.md                  # Vercel / Supabase デプロイ手順
│   ├── API-REFERENCE.md               # Server Action / 型 / コンポーネント早見
│   ├── FRICTION-LOG.md                # Phase 0 セルフテストの摩擦記録(テンプレ)
│   ├── WORLDVIEW.md                   # 世界観(yes/no list 統合)
│   └── STRUCTURE.md                   # このファイル
│
├── proxy.ts                           # 認証ガード(Next.js 16: 旧 middleware.ts)
├── next.config.ts                     # Next.js 設定
├── postcss.config.mjs                 # PostCSS 設定(Tailwind v4 ロード)
├── tsconfig.json                      # TypeScript 設定
├── next-env.d.ts                      # Next.js 型 reference(自動生成)
├── package.json                       # pnpm、依存、scripts
├── pnpm-lock.yaml                     # ロックファイル(pnpm)
├── CLAUDE.md                          # Claude Code 操作ガイド(英語、tool-facing)
├── README.md                          # セットアップ手順(日本語)
└── .env.example                       # 環境変数テンプレート
```

---

## 主要ファイル一覧

| ファイル | 役割 | 触る頻度 |
|---|---|---|
| `app/globals.css` | カラー / フォント / 世界観の色彩実装 | 中(世界観調整時)|
| `app/layout.tsx` | metadata、viewport、PWA テーマカラー | 低 |
| `app/manifest.ts` | PWA manifest(名前、アイコン、テーマ色)| 低 |
| `lib/constants/template.ts` | テンプレート定義(Q1-Q3 文言、選択肢)| 中(テンプレ追加時)|
| `lib/types.ts` | 共有型 | 中(スキーマ変更時)|
| `lib/server-actions/entries.ts` | 日次入力ミューテーション | 高(機能追加・AI 統合時)|
| `lib/supabase/middleware.ts` | セッション更新ロジック | 低 |
| `proxy.ts` | 認証ルートガード | 低 |
| `app/today/_components/QuestionFlow.tsx` | 日次フローのオーケストレータ | 高(AI follow-up 実装時)|
| `components/MoonPhase.tsx` | 月相 SVG 描画 | 低 |
| `supabase/migrations/*.sql` | DB スキーマ | 中(機能追加で migration 追加時)|
| `docs/DECISIONS.md` | ADR 追記 | 中(意思決定するたび)|

---

## 依存関係マップ

各 layer がどの layer に依存するか:

```
app/(routes)
    │
    ├─ depends on ─→ components/(AppHeader, MoonPhase)
    │
    ├─ depends on ─→ lib/server-actions/(entries, auth)
    │                     │
    │                     ├─ depends on ─→ lib/supabase/(server)
    │                     └─ depends on ─→ lib/utils/(date, streak)
    │
    ├─ depends on ─→ lib/constants/(template)
    │
    └─ depends on ─→ lib/types.ts(共有型)

proxy.ts
    │
    └─ depends on ─→ lib/supabase/(middleware)

app/globals.css(独立、@import "tailwindcss" のみ)
```

**逆向きには依存しない**:`lib/` から `app/` や `components/` に依存しない(クライアントロジックをドメインから引き剥がす)。

---

## どこに何を置くか(新規追加の指針)

| 追加するもの | 置き場所 | 例 |
|---|---|---|
| 新しいルート | `app/{route-name}/page.tsx` | `app/insights/page.tsx` |
| ルート専用コンポーネント | `app/{route}/_components/Foo.tsx` | `app/today/_components/CallbackCard.tsx` |
| 複数ルートで使うコンポーネント | `components/Foo.tsx` | `components/Toast.tsx` |
| 新しいミューテーション | `lib/server-actions/{domain}.ts` | `lib/server-actions/reports.ts` |
| 新しいユーティリティ | `lib/utils/{name}.ts` | `lib/utils/format.ts` |
| 新しい共有型 | `lib/types.ts`(300行超えたら分割)| `interface Report { ... }` |
| 新しい定数(テンプレ等)| `lib/constants/{name}.ts` | `lib/constants/templates-extra.ts` |
| 新しい migration | `supabase/migrations/{timestamp}_{description}.sql` | `20260601000000_add_callback_state.sql` |
| 新しい ADR | `docs/DECISIONS.md` に **追記**(既存変更禁止) | `## ADR-020: ...` |
| 新しい仕様セクション | `docs/SPEC.md` の該当箇所に追記 | §9 の後に §10 として |

Server Action / Form など主要パターンの最小例は `CLAUDE.md`、API 早見は `docs/API-REFERENCE.md` を参照。実装は `lib/server-actions/entries.ts` が canonical な雛形。

---

## 参考リンク

- **詳細な技術仕様** → `docs/SPEC.md`
- **意思決定の理由** → `docs/DECISIONS.md`
- **世界観 / NG リスト** → `docs/WORLDVIEW.md`
- **デプロイ手順** → `docs/DEPLOYMENT.md`
- **API 早見表** → `docs/API-REFERENCE.md`
- **Claude Code 操作ガイド** → ルートの `CLAUDE.md`(セッションごとに自動 inject、HANDOFF.md は ADR-020 で廃止)
