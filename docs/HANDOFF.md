# Claude Code への引き継ぎ

> このプロジェクトを Claude Code で扱うとき、最初に読むファイル。
> Last updated: 2026-05-16

## 現状

このプロジェクトは **転換点** にある:

- **v0 実装は完了済み**、`hoshifumi/` ディレクトリに存在(2026-05-16 に `mittsu/` から物理リネーム完了)
- v0 はビルド検証済み:`pnpm build` 成功、全ページ生成 OK
- v0 はまだ **デプロイされていない**
- v0 はまだオーナーに **使われていない**(Phase 0 = 30日セルフテスト未開始)
- 2026-05-14/16 にコンセプト・名前・世界観が大きく pivot した(ADR-011〜019 参照)。コードはほぼ追従済み、ただし AI follow-up(ADR-012)と関連 DB migration は未実装

次フェーズはセルフテストの結果次第。

## Claude Code が次にすべきこと(順番)

### 即時(機能着手前に必須)

1. **`CLAUDE.md`(ルート)を読む**
2. **`docs/PRD.md`** でプロダクト全体像
3. **`docs/ROADMAP.md`** で現フェーズ確認
4. **`docs/DECISIONS.md`** の特に ADR-016(引用係原則)、ADR-017(callback)、ADR-019(worldview)を押さえる
5. **オーナーに質問**:
   - 「Phase 0(セルフテスト)中?Day N まで?」
   - 「v0 デプロイ済み?手伝う必要ある?」
   - 「セルフテスト中に気づいた UX 摩擦ある?」

### オーナーが Phase 0 セルフテスト中なら

手伝うこと:
- Vercel へのデプロイ(`docs/DEPLOYMENT.md` 参照)
- 使用中に見つかったバグ修正(小さく、focused に)
- **新機能の追加はしない**
- ひっかかり記録の `docs/FRICTION-LOG.md`(無ければ作る)

### Phase 0 が成功したら(21日以上連続使用)

v1.0 着手:
- `docs/ROADMAP.md` の v1.0 セクション
- インパクト最大の項目から(おそらく:AI follow-up 実装 + DB migration)
- タスクごとに具体スコープを提案してから実装
- **常に `docs/SPEC.md`** で技術仕様を確認
- **常に `docs/DECISIONS.md`** で過去 ADR を確認

### Phase 0 が失敗したら(21日前に途切れた)

これは **重要シグナル**:
- 新機能は追加しない
- `docs/FRICTION-LOG.md` で根本原因を特定
- よくある原因:
  - 通知が安定して発火しない
  - 入力 UX に摩擦が多すぎる
  - テンプレートがあっても「何を書けばいいか」で詰まる
- ピンポイントな UX 変更を提案
- 修正後 Phase 0 をやり直す

## 意思決定の哲学

オーナーは **副業でやってる個人開発者**。最適化対象:

1. **出荷可能性**: 動くコード > 完璧なコード
2. **保守性**: 3ヶ月後の自分が理解できる
3. **イテレーション容易性**: 書き直しが必要な決定をしない
4. **アンチ bloat**: フィーチャークリープを積極的に拒否(PRD Anti-Goals 参照)

迷ったら:
- ✅ 小さい方を出荷
- ✅ ベストプラクティスじゃなくても既存パターンに合わせる
- ❌ 正当化なしに新しい依存を入れない
- ❌ 動いてるコードを意味なくリファクタしない

## v0 で確立された設計パターン

明確な理由がない限り従う。

### ファイル構成
- ルート: `app/{route-name}/page.tsx`
- ルート専用コンポーネント: `app/{route}/_components/Foo.tsx`(アンダースコア prefix = ルートじゃない)
- 共通コンポーネント: `components/Foo.tsx`
- Server Action: `lib/server-actions/{domain}.ts`
- 型: `lib/types.ts`(300行を超えたら分割)

### Server Action パターン
```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface FooInput {
  // ...
}

export async function doFoo(input: FooInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // ... mutation logic

  revalidatePath("/relevant-path");
  return { success: true, /* ... */ };
}
```

### フォーム + Server Action パターン
```tsx
"use client";

import { useState, useTransition } from "react";
import { doFoo } from "@/lib/server-actions/foo";

export function FooForm() {
  const [pending, startTransition] = useTransition();
  // ...
  function handleSubmit() {
    startTransition(async () => {
      await doFoo(input);
    });
  }
}
```

### Tailwind クラスパターン(ADR-019 / 色移行後)
- Primary CTA: `rounded-xl bg-primary-500 px-4 py-3 text-base font-medium text-neutral-50 shadow-sm hover:bg-primary-600`
- Secondary button: `rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100`
- Card: `rounded-2xl bg-neutral-50 border border-neutral-200 p-5`
- Active state: `bg-primary-50 border-primary-500`
- ※ `bg-white` / `text-white` は **使わない**(色スキーム移行後の anti-pattern)

## よくある質問

### Q: テストを追加すべき?
v0 にはテストがない。以下のときに追加:
- 同じバグが2回以上再発
- 複雑なロジックの実装(streak 計算、AI プロンプト構築)
- v1.0 ローンチ前: Playwright で login → エントリ送信の happy-path E2E を追加

### Q: X をきれいにするためにリファクタすべき?
たぶん不要。例外は:
- X が特定機能の実装を妨げている
- X が最近バグの原因になった
- リファクタが30分以下で完結する

### Q: 依存を更新すべき?
以下のときだけ:
- セキュリティパッチ
- 特定機能に必要
- オーナーが明示的に依頼

最新版維持のための更新はしない。

### Q: オーナーが「もっときれいにして」と言ったら?
`app/globals.css` を開いて既存トークンを見る。新しい色・間隔を導入しない。既存 UI の **一貫性のズレ** をまず探す。本当に必要なら、2-3 案のモックアップ(コード)を出してオーナーに選ばせる。
ADR-019(worldview)に照らして判断 — 「夜、ふとんから星を見上げる」の像にハマるか?

### Q: オーナーが PRD anti-goals に違反する機能を頼んできたら?
押し返す。具体的な anti-goal を引用する。根本ニーズを満たす代替案を提案する。

例:「streak 損失通知を追加して」 → ADR-008(罰しない)を引用 → 「3日無使用時の優しいリマインド」を提案

### Q: オーナーが AI に解釈させる機能を頼んできたら?
ADR-016(引用係原則)を引用して押し返す。AI は引用・選択・配置までで、解釈・ラベリング・診断はしない。代替案を提案。

## オーナーの profile

- 日本人フロントエンドエンジニア、約10年
- Next.js / React / Supabase に慣れている
- 過去にプロジェクト出荷経験あり(Meguru, まなぶん)
- 埼玉県秩父市在住
- 小さい子どもあり(開発時間限定)
- バスケットボール趣味
- Obsidian で個人ナレッジ管理
- 日本語でやりとり、コード/コメントの英語は OK
- **壁打ちスタイル**を好む(構造化された選択肢の連発より、開いた対話で考えを共有してほしい)

## オーナーとのコミュニケーション

- 直接的、装飾不要
- 具体案を提案する、オープンエンドの質問を投げない
- 悪い案は押し返す(ADR や PRD を引用)
- 変更を提案するときは before/after diff を簡潔に
- すでに知ってる技術概念を過剰説明しない
- 日本語的なヘッジ(「〜かもしれません」「〜と思います」)は歓迎
- **生の思考過程を見せる**(完成版だけ出すより、迷ってる箇所も共有する)

## 探し物の場所

| 知りたいこと | 場所 |
|---|---|
| ある決定の理由 | `docs/DECISIONS.md`(特に最近の ADR-011〜019) |
| どの機能がスコープ内か | `docs/ROADMAP.md`(現バージョン) |
| X の実装方法 | `docs/SPEC.md`(X で検索) |
| プロダクト価値 / anti-goal | `docs/PRD.md` Section 3 |
| ユーザーペルソナ | `docs/PRD.md` Section 4 |
| 技術スタックの根拠 | `CLAUDE.md` + `docs/DECISIONS.md` |
| デプロイ手順 | `docs/DEPLOYMENT.md` |
| コードパターン | このファイルの「v0 で確立された設計パターン」 |
| 世界観の定義(canonical) | `docs/DECISIONS.md` ADR-019 |
| 世界観の operational reference / NG カタログ / 色・タイポ・コピー基準 | `docs/WORLDVIEW.md` |
| **デザインシステム / AI agent 向けトークン+コンポーネント仕様** | `docs/DESIGN.md`(Stitch format) |
| **モーション仕様(duration / easing / use case 表 / anti-pattern)** | `docs/MOTION.md` |
| **Pencil でビジュアルデザインを作る方法** | `docs/PENCIL.md` |
| ファイル構成 / 何をどこに置くか | `docs/STRUCTURE.md` |
| API / Server Action / 型 早見 | `docs/API-REFERENCE.md` |
| **次に何やる? / TODO / 意思決定が必要な論点** | `docs/NEXT-ACTIONS.md`(canonical NA リスト) |

## 編集してはいけないファイル

これらはオーナーが管理:
- `docs/PRD.md`(プロダクト戦略)
- `docs/DECISIONS.md`(ADR は追記のみ、既存は変更しない)
- `docs/ROADMAP.md`(オーナーがバージョン計画を管理)

diff を提案する形で変更を持ちかけるのは OK、ただし直接編集はしない。

## 常に最新に保つべきファイル

- `CLAUDE.md`(Claude Code 自身の操作マニュアル)
- `docs/SPEC.md`(実装が乖離したら更新)
- `docs/HANDOFF.md`(このファイル — フェーズが変わったら "現状" を更新)
- `README.md`(セットアップ手順が変わったら更新)

## 最後に

これは個人 SaaS プロジェクト。成功は以下:

- オーナーが1年以上使い続ける
- 24ヶ月で課金ユーザー 1,000
- 粗利 80%+
- シンプルさを保つ、個人性を保つ、有用性を保つ

これを壊さないこと。
