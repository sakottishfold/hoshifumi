---
id: 002
title: Phase 1 LLM provider 選定(Claude vs 無料 LLM)
status: closed
priority: medium
type: question
opened: 2026-05-18
closed: 2026-05-18
related-spec: null
related-plan: null
related-adr: ADR-021
related-commits: null
---

## 背景

オーナーから提起:「Phase 1(= v1.0 AI follow-up + 月次レポート、ADR-012 / 016)で Claude や Gemini を使うとコストが気になる。そこまで高い精度が必要なわけではないから、無料で日本語対応の LLM を使うのは?」

SPEC.md は現状 Claude Sonnet 4.6 default / Haiku 4.5 fallback を指定。コスト試算:Haiku で owner only ≈ $0.005 / 月、1000 user ≈ $5 / 月。絶対値は小さいが、Phase 0 / 早期 v1.0 β 期間は「無料で済むなら無料で」が合理的。

## 議論サマリ(2026-05-18 セッション)

検討候補と比較表は本文 below に展開済み(本セッションログ参照)。要点だけ抜粋:

| 候補 | 無料枠 | JP 精度 | ADR-016 遵守 | 採否 |
|---|---|---|---|---|
| Claude Sonnet/Haiku(現 SPEC) | なし(従量) | ◎ | ◎ | 棄却(Phase 1 ではコスト過大) |
| **Gemini 2.0 Flash** | 15 RPM / 1500 RPD / 1M TPM | ◎ | ○ | **採用** |
| Llama 3.3 70B (OpenRouter) | 不安定 | △ | △ | 棄却 |
| Qwen 2.5 / 3 | あり | ○ | ○ | 候補残るが Gemini 優位 |
| DeepSeek V3 | 寛大 | △ 未実測 | ○ | 候補残るが JP 実測なし |

## 結論

**Gemini 2.0 Flash を Phase 1 LLM provider に採用。** `lib/ai/` 抽象化層を介して呼び出し、v1.1+ スケール時に provider 差し替え可能にする。

→ 詳細仕様 / 影響 / 未解決の論点は **ADR-021**(`docs/DECISIONS.md`)に正式記録。

## 着地条件(本 issue として閉じる根拠)

- [x] 検討した代替案がドキュメント化されている(本 issue + ADR-021 検討選択肢)
- [x] 採用判断が ADR-021 として明文化
- [x] ADR-016 引用係原則 compliance の実測必要性が ADR-021 影響セクションに明記
- [x] vendor lock-in mitigation(`lib/ai/` 抽象化)が ADR-021 影響に明記

## 関連 / 影響範囲

- **ADR-021**(本 issue の決定文書、`docs/DECISIONS.md` 末尾追記)
- **ADR-012**(AI follow-up question 実装)─ 着手時に Gemini API integration が必要
- **ADR-016**(AI は引用係)─ Gemini で原則遵守できるか実測必要(ADR-012 first task)
- **SPEC.md** AI セクション ─ Claude 言及を Gemini に更新(ADR-012 着手時に同時改訂)
- **`.env.example`** に `GEMINI_API_KEY` 追加(ADR-012 着手時)

## オープン質問(本 issue ではなく ADR-021 でトラック)

- Claude switch 閾値
- Pro モデル使い分け(follow-up = Flash、report = Pro?)
- 引用係原則違反の自動検出
