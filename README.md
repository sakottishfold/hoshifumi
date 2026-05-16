# ほしふみ

> 寝る前の5分、自分を見つめ直す。

Pre-sleep journaling アプリ。Next.js 16 (App Router) + Supabase + Claude API。

> 改名履歴:「みっつ」→「いとなみ」(2026-05-14, ADR-015)→「ほしふみ」(2026-05-16, ADR-018)。詳細は `docs/DECISIONS.md`。ディスク上のフォルダも `hoshifumi/` に rename 済み(2026-05-16)。

## できること(v0)

- ✅ Magic Link でメールログイン
- ✅ 毎日の入力(体の感じ・今日のひとコマ・明日へひとこと)
- ✅ カレンダービューで過去ログ閲覧
- ✅ 個別日詳細表示
- ✅ 連続記録カウント
- ✅ PWA対応(ホーム画面追加可)

これからやる(v1.0+):

- ⏳ AIフォローアップ問(寝る前ループにClaude Haikuを差し込む — ADR-012)
- ⏳ 追加テンプレ
- ⏳ 月次AIレポート (Claude Sonnet 4.6)
- ⏳ プッシュ通知
- ⏳ 音声入力
- ⏳ 課金 (Stripe)

## セットアップ

### 1. リポジトリの取得

```bash
unzip hoshifumi.zip   # (旧 mittsu.zip)
cd hoshifumi
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. Supabase プロジェクト作成

1. https://supabase.com/dashboard にログイン
2. **New Project** → 名前は「hoshifumi」(または「mittsu」のまま、好み)、リージョンは Tokyo (ap-northeast-1) 推奨
3. データベースパスワードを保存
4. プロジェクト作成完了まで待つ

### 4. データベース初期化

Supabase Dashboard の **SQL Editor** を開いて、`supabase/migrations/20260510000000_initial.sql` の中身を貼り付けて実行。

(Supabase CLI を使うなら: `supabase db push`)

### 5. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を編集:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Settings → API → anon public key
- `SUPABASE_SERVICE_ROLE_KEY`: Settings → API → service_role key (秘密)
- `ANTHROPIC_API_KEY`: 月次AIレポート機能用 (v0では未使用、v1.1から必要)

### 6. Magic Link の Email Template 設定

Supabase Dashboard → Authentication → Email Templates → Magic Link
**Redirect URL** を `http://localhost:3000/auth/callback` (本番は実URLに) に設定。

開発初期はメール送信は Supabase 標準を使うが、本番リリース時は Resend や Postmark に切り替え推奨(到達率が高い)。

### 7. 起動

```bash
pnpm dev
```

http://localhost:3000 を開く → Magic Link 送信 → メール確認 → ログイン → 今日のほしふみへ。

## 主要なコマンド

```bash
pnpm dev        # 開発サーバー起動
pnpm build      # プロダクションビルド
pnpm start      # ビルド済みプロダクションサーバー
pnpm typecheck  # TypeScript 型チェック
pnpm lint       # ESLint
```

## ディレクトリ構成

```
hoshifumi/
├── app/
│   ├── (auth系: login, auth/callback)
│   ├── (アプリ系: today, calendar, settings)
│   ├── layout.tsx
│   └── page.tsx (認証状態でリダイレクト)
├── components/        # 共通コンポーネント
├── lib/
│   ├── supabase/      # Supabaseクライアント
│   ├── server-actions/# Server Actions
│   ├── utils/         # ユーティリティ
│   ├── constants/     # テンプレ定義など
│   └── types.ts       # 型定義
├── supabase/
│   └── migrations/    # SQLマイグレーション
└── proxy.ts           # 認証チェック (Next.js 16でmiddleware→proxyにリネーム)
```

## デプロイ(Vercel)

1. GitHub にpush
2. Vercel で New Project → Import
3. Environment Variables に `.env.local` の中身を全部入れる
4. デプロイ完了後、Vercel のURLを `NEXT_PUBLIC_SITE_URL` に設定し直す
5. Supabase の Authentication → URL Configuration に Vercel のURL を追加 (Redirect URLs)

## 30日テストの進め方

このv0でやることはひとつ。**自分が30日続けるか**。

- [ ] 毎晩22:00頃にスマホで `/today` を開く
- [ ] 体の感じをタップ → 今日のひとコマ → 明日へひとこと、を5分の儀式として
- [ ] 7日 → 14日 → 21日 → 30日 と連続記録を伸ばす(スキップ日も罰しない)
- [ ] 続かなかった日があったら、その理由をメモ
- [ ] 30日後に自分でレビュー

続いたら、AIフォローアップ問・追加テンプレ・月次AIレポートを実装してβ版へ。
続かなかったら、UXのどこに摩擦があったか分析してから次のイテレーション。

## トラブルシューティング

### Magic Link が届かない
- Supabase の Auth Settings で SMTP 設定を確認
- スパムフォルダを確認
- 開発時は Supabase Dashboard → Authentication → Users から手動でユーザー作成して試す手も

### "Not authenticated" エラー
- proxy.ts でセッション更新が走っているか確認
- `.env.local` が正しく読み込まれているか (再起動で反映)

### iPhone で PWA 化できない
- HTTPS必須(本番はVercelで自動)
- Safari で開く必要あり、Chrome iOSは不可
- 共有 → ホーム画面に追加

## 関連ドキュメント

Obsidian Vault 内の `個人開発/みっつ/` (旧名で残置)に詳細仕様あり:
- `00_概要.md` - ハブノート
- `01_市場規模調査.md` - TAM/SAM/SOM、競合分析
- `02_MVP仕様書.md` - 機能要件、ロードマップ
- `03_LP草案.md` - LPコピー
- `04_データモデル.md` - Schema完全版
- `05_Day1実装材料.md` - 実装手順書

## ライセンス

私的開発用、ライセンス未定。
