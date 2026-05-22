-- ADR-025: テンプレートをユーザー単位の設定にする。
-- profiles.template_name に「ユーザーが選んだ日記テンプレ」を持たせる。
-- NULL = onboarding 未完了(初回テンプレ選択前)。default は付けない
-- (「未完了」と「basic を選んだ」を区別するため)。
alter table profiles
  add column template_name text;

comment on column profiles.template_name is
  'ユーザーが選んだ日記テンプレ。NULL = onboarding 未完了(初回テンプレ選択前)。';

-- 既存 profile を backfill:直近エントリのテンプレ、無ければ basic。
-- これにより既存ユーザーは onboarding 画面を踏まずに済む。
update profiles p
set template_name = coalesce(
  (select e.template_name from entries e
   where e.user_id = p.id
   order by e.entry_date desc limit 1),
  'basic'
)
where p.template_name is null;
