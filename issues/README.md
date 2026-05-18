# issues

> ad-hoc に発見されたバグ / 小さな機能要望 / 質問・検討事項を **1 件 1 ファイル** で積んでいく場所。
>
> 戦略レベル(Phase 0 / v1.0 / v1.1 等)の TODO は `docs/NEXT-ACTIONS.md` に残す。
> issues は **戦術レベル**:書き留めないと忘れる、いつ着手するかは別途判断、というもの。

## ディレクトリ構造

```
issues/
├── README.md                                  # 本ファイル
├── {YYYY-MM-DD}-{kebab-slug}.md               # 1 issue 1 ファイル
└── ...
```

ファイル命名:`{オープン日}-{短い slug}.md`(例:`2026-05-18-past-date-journal-entry.md`)。
chronological + 検索しやすい。

## issue ファイル format

```markdown
---
id: 002                          # 連番、`ls issues/*.md | wc -l` + 1 程度の決め方で OK
title: 過去日でジャーナル作成・編集    # 1 行サマリ
status: open                     # open | in-progress | closed | wontfix
priority: medium                 # low | medium | high
type: feature                    # feature | bug | question | chore
opened: 2026-05-18               # YYYY-MM-DD
closed: null                     # YYYY-MM-DD or null
related-spec: null               # docs/specs/... path or null
related-plan: null               # docs/plans/... path or null
related-commits: null            # SHA リスト or null
---

## 背景
何が起きた / 何が要望か。状況。

## 求めたい体験(feature の場合)/ 期待挙動(bug の場合)
具体的にどうなって欲しいか。

## acceptance criteria(着手前に詰める)
- [ ] こうなれば close できる、の条件箇条書き

## 関連 / 影響範囲
- 既存コード / 仕様 / ADR への影響
- 他の issue / NEXT-ACTIONS との関係

## オープン質問(あれば)
- まだ決まってない論点
```

frontmatter の field は最低限。closed にするときは `status: closed` + `closed:` 日付追加。

## issue を積む手順(人間 + claude code 共通)

1. 「これ issue 立てて」と言う、または claude code が自発的に検出して下書く
2. `issues/{YYYY-MM-DD}-{slug}.md` を作成(`status: open`、最小限の skeleton で OK)
3. 必要に応じて NEXT-ACTIONS から参照("issues/...md 参照"の1行)
4. commit `chore(issues): open #N {title}` で履歴に残す

## 進めるとき

1. status を `in-progress` に変更
2. spec / plan が必要なら作成、frontmatter `related-spec` / `related-plan` を埋める
3. 実装、commit を `related-commits` に記録
4. 着地したら `status: closed` + `closed: YYYY-MM-DD`
5. commit `chore(issues): close #N {title}`

`wontfix` は「議論したが入れない」結論で永続化、消さない(将来再考の参考)。

## NEXT-ACTIONS.md との使い分け

| | NEXT-ACTIONS.md | issues/ |
|---|---|---|
| スコープ | 戦略 / フェーズ管理 | 戦術 / 細部 |
| 粒度 | 大きい(Phase 0 / v1.0 / v1.1) | 小さい(1 機能 / 1 バグ) |
| 数 | 数十、生きてるリスト | 数百、open/closed 含めて履歴 |
| 着手判断 | フェーズの readiness で決まる | priority + 文脈で逐次 |
| 形式 | 1 ファイル(チェックリスト) | 1 件 1 ファイル(frontmatter + 本文) |

NEXT-ACTIONS は **canonical な「次に何をするか」のリスト**で、issues はその下に蓄積する **「いつかやる」プール**。
NEXT-ACTIONS から issues を参照することはあるが、issues から NEXT-ACTIONS への昇格は手動判断(=「これ次の phase でやろう」となったら NEXT-ACTIONS に1行追加)。

## priority の目安

- **high**:user 体験を壊している / Phase 0 のセルフテストを潰す / 本番停止系
- **medium**:user 体験を損なう / 観察できる friction / 次のリリース target
- **low**:nice-to-have / 内部品質 / 長期 backlog

priority は **絶対値ではなく相対値**。「これが今一番大事だっけ?」を時々見直す。
