---
id: 001
title: 過去日でジャーナル作成・編集
status: closed
priority: medium
type: feature
opened: 2026-05-18
closed: 2026-05-18
related-spec: docs/specs/2026-05-18-past-date-journal-entry-design.md
related-plan: docs/plans/2026-05-18-past-date-journal-entry.md
related-commits: fff1108, 83487cb, 1cd1fbf, 6c2f710
---

## 背景

現状 `/today` は **当日の entry のみ submit 可能**(`todayJST()` 固定)。
forget した日や、後から書きたい日(寝落ちで書けなかった、出張中、等)に
**遡って書く / 修正する** 動線がない。

`/calendar/[date]` は既存 entry の閲覧はできるが、空欄日への作成 / 既存日の修正は
UI 未実装。data 層では `submitEntry({ date: "..." })` が任意日対応している(server-action
は date 引数を受け取れる)ので、UI の expose 設計だけが残っている。

worldview「夜、ふとんから星を見上げる」観点:過去日の星を「あとから灯せる」ことは
受動的・寛容な姿勢と整合(無理に毎日やらせない / 完璧主義を強要しない)。

## 求めたい体験

- カレンダーで空欄の過去日をタップ → 「この日のことを書く」入力 UI
- カレンダーで既存 entry の日をタップ → 「修正する」入力 UI(Q1/Q2/Q3 編集)
- 入力済みの場合は既存値が prefill されている
- 「今日のこと」と区別がつくよう、ヘッダーで日付明示(「5月14日(Wed)のこと」等)

## acceptance criteria

- [ ] `/calendar/[date]` で当日 / 過去日いずれも entry 作成・編集できる
- [ ] 入力 UI は `/today` と同じ QuestionFlow コンポーネントを再利用(`initialEntry` + `date` 渡し)
- [ ] submit 完了後の遷移先は要検討(/today/done に遡及表示?それとも /calendar に戻る?)
- [ ] streak 計算が遡及 entry を正しく扱う(過去日 entry が連続日数に組み込まれる)
- [ ] callback / Star Bloom milestone の発火条件への影響を整理(過去日 entry も entry-count に加算 = milestone 発火タイミングが前にズレる可能性)
- [ ] 未来日への書き込みは禁止(`entry_date > todayJST()` で reject)

## 関連 / 影響範囲

- **既存コード**:
  - `app/today/_components/QuestionFlow.tsx`(`date` prop は既に持ってる)
  - `app/calendar/[date]/page.tsx`(現状 read-only と思われる、未確認)
  - `lib/server-actions/entries.ts` `submitEntry`(任意日対応済み、追加 validation 必要かも)
- **仕様 / ADR**:
  - ADR-008(streak 罰しない)─ 遡及 entry が streak を「直す」体験は罰しない原則と整合
  - ADR-017(callback)─ entry-count ベース、遡及で milestone が前倒し発火する挙動の是非
  - 新規 ADR 必要?(過去日記入の polylcy:いつまで遡れるか、未来日記入の禁止、編集回数制限 等)
- **NEXT-ACTIONS**:🌓 v1.0 「あると嬉しい」セクションに既に「エントリの template_name 編集」あり、関連スコープ

## オープン質問

1. 過去日記入は **いつまで遡れる**?(7日前 / 30日前 / 制限なし)
2. submit 後の遷移は?(/today/done への遡及表示 / /calendar に戻る / 直前画面に戻る)
3. **streak 再計算** は遡及 entry で過去の連続性が確立されたら反映する?(例:今日 5本目 / 昨日 forget / 一昨日 4本目 → 遡って昨日書く → streak が 5)
4. callback milestone(5/15/25/35 等)が遡及 entry で **過去に「発火 should だった」状態**になったとき、その日の callback を出すのか / 出さないのか
5. Star Bloom の hero phase / burst:`/calendar/[date]` 経由の submit で /today/done に遷移するなら、bloom はその日の phase / total を反映する?それとも calendar に戻るので bloom 不要?
6. 「過去日への書き込み」UI 上の表現:そのまま「書く」?それとも「灯す」「あとから灯す」みたいな worldview コピー?

## 着手判断

Phase 0(オーナーの30日セルフテスト)で「今日書き忘れた」摩擦が **observable に発生** したら priority を high に格上げ、即着手検討。それまでは medium。
