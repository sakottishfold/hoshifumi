-- ============================================================
-- みっつ - Day 1 初期マイグレーション
-- ============================================================

-- profiles: ユーザープロファイル(auth.users に紐づく)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  email text not null,
  notification_time time default '22:00:00',
  notification_enabled boolean default true,
  timezone text default 'Asia/Tokyo',
  plan text check (plan in ('free', 'pro', 'premium')) default 'free',
  streak_days integer default 0,
  longest_streak integer default 0,
  last_entry_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 自動 profiles レコード作成 trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- entries: 日次の入力(1ユーザー1日1エントリ)
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  entry_date date not null,
  template_name text not null default 'basic',
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

-- answers: 各質問への回答
create table answers (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries on delete cascade not null,
  question_position integer not null check (question_position between 1 and 3),
  value_number integer,
  value_text text,
  value_choice text,
  created_at timestamptz default now(),
  unique(entry_id, question_position)
);

-- インデックス
create index idx_entries_user_date on entries(user_id, entry_date desc);
create index idx_answers_entry on answers(entry_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table entries enable row level security;
alter table answers enable row level security;

-- profiles: 本人のみ閲覧/更新可
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- entries: 本人のみCRUD可
create policy "Users can view own entries"
  on entries for select using (auth.uid() = user_id);

create policy "Users can insert own entries"
  on entries for insert with check (auth.uid() = user_id);

create policy "Users can update own entries"
  on entries for update using (auth.uid() = user_id);

create policy "Users can delete own entries"
  on entries for delete using (auth.uid() = user_id);

-- answers: 親entryが本人のもののみCRUD可
create policy "Users can view own answers"
  on answers for select using (
    exists (
      select 1 from entries
      where entries.id = answers.entry_id
      and entries.user_id = auth.uid()
    )
  );

create policy "Users can insert own answers"
  on answers for insert with check (
    exists (
      select 1 from entries
      where entries.id = answers.entry_id
      and entries.user_id = auth.uid()
    )
  );

create policy "Users can update own answers"
  on answers for update using (
    exists (
      select 1 from entries
      where entries.id = answers.entry_id
      and entries.user_id = auth.uid()
    )
  );

create policy "Users can delete own answers"
  on answers for delete using (
    exists (
      select 1 from entries
      where entries.id = answers.entry_id
      and entries.user_id = auth.uid()
    )
  );
