-- ADR-024: AI follow-up multi-turn 化。
-- AI 対話ターンを answers の pos 4,5,6 に保存するため CHECK を緩める。
-- 既存制約は between 1 and 5(20260517000000_callback_state.sql)。
alter table answers
  drop constraint answers_question_position_check,
  add constraint answers_question_position_check
    check (question_position between 1 and 8);
