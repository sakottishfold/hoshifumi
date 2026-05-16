-- ============================================================
-- ADR-017 / SPEC §8: Past-entry callback の state 列
-- ADR-012 (AI follow-up) の schema 前準備も同梱
-- ─ Phase 0 では answers.question_text は使わないが、v1.0 で
--   migration を再デプロイしないために forward-compat で入れる
-- ============================================================

-- callback state (ADR-017)
alter table profiles
  add column last_callback_at timestamptz,
  add column unlocked_stage integer not null default 0;

comment on column profiles.last_callback_at is
  'ADR-017: 最後に callback が発火した時刻。cool-down 判定用';
comment on column profiles.unlocked_stage is
  'ADR-017 γ stage モデル: unlock 済み最高 stage (0 = pre-Stage 1)';

-- AI follow-up forward-compat (ADR-012, Phase 0 では未使用)
alter table answers
  drop constraint answers_question_position_check,
  add constraint answers_question_position_check
    check (question_position between 1 and 5),
  add column question_text text;

comment on column answers.question_text is
  'ADR-012 AI follow-up: 動的生成質問の本文。固定 Q (pos 1/2/3) では null';
