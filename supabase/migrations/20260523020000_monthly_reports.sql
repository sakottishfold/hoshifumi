-- ADR-016 準拠の月次レポートテーブル。
-- 出力は 5 つの curation primitive のみ(数値統計 / 頻出語 / 印象的だった日 /
-- 重みのある一言 / 対比のペア)。summary_text / insight / theme 等の自由文
-- フィールドは持たない ── スキーマレベルで物理的に防ぐ。

create table monthly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),

  -- 1. 数値統計(deterministic)
  entry_count integer not null,
  body_phase_distribution jsonb not null default '{}'::jsonb,

  -- 2. 頻出語(deterministic、降順を保つため配列)
  word_frequencies jsonb not null default '[]'::jsonb,

  -- 3. 印象的だった日(AI 選択、entry_id のみ)
  highlight_entry_ids uuid[] not null default '{}',

  -- 4. 重みのある一言(AI 選択、verbatim 引用)
  top_phrases jsonb not null default '[]'::jsonb,

  -- 5. 対比のペア(AI 選択、entry_id ペアのみ)
  day_pairs jsonb not null default '[]'::jsonb,

  generated_at timestamptz not null default now(),
  unique (user_id, year, month)
);

create index idx_monthly_reports_user_year_month
  on monthly_reports (user_id, year desc, month desc);

-- RLS:本人のみ select 可。insert/update/delete は Cron が service role で行う
-- (CLAUDE.md「cron jobs は service role 許可」)。
alter table monthly_reports enable row level security;

create policy "monthly_reports: select own"
  on monthly_reports for select
  using (auth.uid() = user_id);
