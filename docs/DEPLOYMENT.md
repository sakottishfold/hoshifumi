# デプロイガイド

> 本番デプロイのステップバイステップ手順。
> Last updated: 2026-05-16

## 前提

- [Vercel アカウント](https://vercel.com)
- [Supabase アカウント](https://supabase.com)
- [Anthropic Console アカウント](https://console.anthropic.com)(v1.0+ AI follow-up と v1.1+ 月次レポート用)
- ドメイン(任意。Vercel が提供する vercel.app サブドメインでも可)
- 本番メール用:[Resend](https://resend.com) アカウント(v1.0+)

## Step 1: Supabase セットアップ

### 1.1 プロジェクト作成

1. https://supabase.com/dashboard を開く
2. **New Project**
   - 名前:`hoshifumi`(または `hoshifumi-prod`)
   - リージョン:**Tokyo (ap-northeast-1)** ─ 日本のユーザー向けに最低レイテンシ
   - DB パスワード:強いものを生成、1Password に保存
3. プロビジョニングを約2分待つ

### 1.2 初期 migration を実行

1. Supabase Dashboard の **SQL Editor** を開く
2. `hoshifumi/supabase/migrations/20260510000000_initial.sql` の中身を貼り付け
3. 実行
4. **Table Editor** で確認:`profiles` / `entries` / `answers` テーブルが存在し、RLS 有効

### 1.3 Auth 設定

1. **Authentication** → **Providers**
   - Email:有効化(Magic Link がデフォルト)
2. **Authentication** → **URL Configuration**
   - Site URL:`https://your-vercel-url.vercel.app`(Step 2 完了後)
   - Redirect URLs:`https://your-vercel-url.vercel.app/auth/callback` を追加
   - ローカル開発用:`http://localhost:3000/auth/callback` も追加
3. **Authentication** → **Email Templates** → **Magic Link**
   - (任意)件名・本文を日本語にカスタマイズ
   - デフォルト件名:"Your Magic Link" → 推奨:「ほしふみへログイン」

### 1.4 API キーを取得

**Settings** → **API**:

- `NEXT_PUBLIC_SUPABASE_URL`:Project URL(例:`https://xxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`:`anon public` key
- `SUPABASE_SERVICE_ROLE_KEY`:`service_role` key(**秘密厳守、絶対にコミットしない**)

3つとも Vercel の env 設定で使うので保存しておく。

### 1.5 メール到達性(本番のみ)

Supabase デフォルトのメール送信は rate-limit あり(3/時)で、スパム判定されやすい。

本番(v1.0+)では:

1. Resend に登録
2. ドメイン認証(DNS レコード設定)
3. Supabase で **Project Settings** → **Auth** → **SMTP Settings**
4. 設定:
   - Sender email:`noreply@yourdomain.com`
   - Host:`smtp.resend.com`
   - Port:`465`
   - Username:`resend`
   - Password:Resend API キー

## Step 2: Vercel デプロイ

### 2.1 GitHub に push

```bash
cd mittsu
git init
git add .
git commit -m "Initial commit: hoshifumi v0"
git branch -M main
git remote add origin git@github.com:yourname/hoshifumi.git
git push -u origin main
```

### 2.2 Vercel にインポート

1. https://vercel.com/new
2. GitHub レポジトリをインポート
3. Framework Preset:**Next.js**(自動検出)
4. Root Directory:`./`(デフォルト)
5. Build Command:`pnpm build`(`package.json` の packageManager フィールドで自動検出されるはず)
6. Output:`.next`(デフォルト)

### 2.3 環境変数

Vercel Project Settings → Environment Variables に追加:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NEXT_PUBLIC_SITE_URL=https://your-vercel-url.vercel.app
ANTHROPIC_API_KEY=sk-ant-xxx...  (v1.0+ で必須)
```

### 2.4 デプロイ

**Deploy** をクリック。約2分待つ。

### 2.5 Supabase の Site URL を更新

デプロイ完了後、Supabase に戻って:
- **Authentication** → **URL Configuration**
- Site URL を Vercel の URL に更新
- Redirect URLs に Vercel の URL を追加

## Step 3: 動作確認

1. ブラウザで Vercel の URL を開く
2. メールアドレスを入れて「ログインリンクを送る」をクリック
3. 受信箱を確認(開発時はスパムフォルダに入ることあり)
4. リンクをクリック → `/today` にリダイレクトされる
5. 日次儀式を完了(身体感覚タップ + 2つの自由記述)
6. Supabase の **Table Editor** で `entries` と `answers` に新しい行ができてるか確認
7. `/calendar` を開く → 今日のエントリが月相アイコン付きで表示されてるはず

## Step 4: カスタムドメイン(任意)

1. Vercel Project Settings → **Domains**
2. ドメインを追加(例:`hoshifumi.app`)
3. 指示通り DNS を設定
4. `NEXT_PUBLIC_SITE_URL` env を新ドメインに更新
5. 再デプロイ
6. Supabase Auth URL Configuration を更新

## Step 5: モバイル設定(セルフテスト用)

### iOS Safari(ターゲットデバイス)

1. Safari で `https://your-domain.com/login` を開く(**iOS Chrome 不可**、PWA インストールは Safari 必須)
2. Magic Link でログイン
3. **共有** → **ホーム画面に追加**
4. ホーム画面に 🌒 アイコンでアプリが追加される
5. ホーム画面から起動 → standalone モード(Safari の chrome なし)

### Android Chrome

1. Chrome で URL を開く
2. メニュー → **アプリをインストール** または **ホーム画面に追加**

## Step 6: Vercel Cron(v1.1 - 月次レポート)

`vercel.json` を作成:

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-reports",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

`/api/cron/monthly-reports/route.ts` を実装(v1.1 タスク)。

Vercel Cron 認証:Cron リクエストは `Authorization: Bearer ${CRON_SECRET}` ヘッダを持つ。`CRON_SECRET` env を設定。

## Step 7: 日次通知リマインダー(Phase 0)

Phase 0 では(Vercel Cron も Web Push もまだ未実装なので)、回避策を使う:

**iOS カレンダー方式**:
1. カレンダーアプリを開く
2. 寝る前の時間(推奨 22:00)に毎日繰り返しのイベントを作成
3. タイトル:「今日のほしふみ」
4. URL:`https://your-domain.com/today`(カレンダーがタップ可能にしてくれる)
5. 通知:5分前

カレンダー通知をタップ → ブラウザ/PWA が開く → 儀式を完了。

## よくある問題

### Magic Link が届かない
- スパムフォルダ確認
- Supabase Auth → Email Templates が有効か確認
- Redirect URL が Vercel URL と完全一致してるか確認(https:// 含む)
- 開発時:Supabase 標準 SMTP は 3/時の rate limit
- 本番:Resend を設定(Step 1.5)

### "Not authenticated" エラー
- `proxy.ts`(旧 `middleware.ts`)が動いてるか確認(Vercel Function ログを見る)
- クッキーが set されてるか確認(DevTools → Application → Cookies)
- クッキー消去して再試行

### Vercel でビルド失敗
- ローカルで `pnpm build` を先に実行してエラーを潰す
- Node バージョン確認:Vercel のデフォルトは 22.x、プロジェクトは Node 20+ 必要
- 全 env が Vercel に設定されてるか確認

### TypeScript エラー
- ローカルで `pnpm typecheck` を実行
- import が全部解決してるか確認(特に `@/*` alias)

## 本番チェックリスト(v1.0 ローンチ前)

- [ ] カスタムドメイン設定
- [ ] Resend SMTP が Supabase で設定済み
- [ ] プライバシーポリシーページが `/privacy` で稼働
- [ ] 利用規約ページが `/terms` で稼働
- [ ] フッターに legal ページへのリンク
- [ ] アナリティクス導入(Plausible / Vercel Analytics)
- [ ] エラートラッキング導入(Sentry / Vercel)
- [ ] DB バックアップ確認(Supabase Pro tier の自動バックアップ)
- [ ] Stripe で Pro/Premium プラン設定
- [ ] Magic Link 送信の rate limit(または Supabase デフォルトを受容)
- [ ] OG image / favicon / apple-touch-icon が全部セット済み
- [ ] 実機テスト(iPhone Safari、Android Chrome)
- [ ] 低速ネットワークテスト(3G スロットル)
