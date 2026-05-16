-- ============================================================
-- ADR-017 Phase 0 callback ローカル検証用シード
-- ============================================================
--
-- 使い方:
--   1. dev サーバー (http://localhost:3000) で Magic Link ログイン
--      (メール: http://localhost:54324 inbucket で受信)
--   2. psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f scripts/seed-callback.sql
--   3. /today から5本目(=今日)を submit
--   4. /today/done で「数日前のあなた」カードが Stage 1 deterministic で発火する
--
-- 自分の auth.users.id は自動取得(local 単一ユーザー想定)。
-- 複数ユーザーいる環境では `select id into uid ...` を以下に置き換え:
--   uid := 'YOUR-UUID-HERE'::uuid;
--
-- 投入内容: 過去 -2, -3, -5, -7 日に1本ずつ計4エントリ。
--   - スキップ日(-1, -4, -6)を含めて「スキップしても callback は出る」も確認
--   - Stage 1 range = position 2-4 = -2/-3/-5 が候補(3つ)
--   - -7 は position 5、Stage 1 では選ばれない想定
--     (Q2 本文に「これが出たらバグ」マーカー入り)
--
-- 再実行可能。既存 seed (同じ user_id × 同じ entry_date) は delete してから再投入、
-- profile の callback state も reset。

do $$
declare
  uid uuid;
  today_jst date := (now() at time zone 'Asia/Tokyo')::date;
  d2 date := today_jst - 2;
  d3 date := today_jst - 3;
  d5 date := today_jst - 5;
  d7 date := today_jst - 7;
  e2_id uuid;
  e3_id uuid;
  e5_id uuid;
  e7_id uuid;
begin
  -- local の単一ユーザー前提で auth.users から取得
  select id into uid from auth.users order by created_at asc limit 1;
  if uid is null then
    raise exception 'No auth.users found. Log in via /login (http://localhost:3000) first.';
  end if;

  -- 既存 seed を削除 (answers は cascade で消える)
  delete from entries
   where user_id = uid
     and entry_date in (d2, d3, d5, d7);

  -- profile の callback state を reset
  -- (再実行で unlocked_stage が残ってると Stage 1 deterministic が走らない)
  update profiles
     set last_callback_at = null,
         unlocked_stage   = 0
   where id = uid;

  -- 4本のエントリ
  insert into entries (user_id, entry_date, template_name, completed_at)
       values (uid, d2, 'basic', (d2 + interval '22 hours')::timestamptz)
    returning id into e2_id;

  insert into entries (user_id, entry_date, template_name, completed_at)
       values (uid, d3, 'basic', (d3 + interval '22 hours')::timestamptz)
    returning id into e3_id;

  insert into entries (user_id, entry_date, template_name, completed_at)
       values (uid, d5, 'basic', (d5 + interval '22 hours')::timestamptz)
    returning id into e5_id;

  insert into entries (user_id, entry_date, template_name, completed_at)
       values (uid, d7, 'basic', (d7 + interval '22 hours')::timestamptz)
    returning id into e7_id;

  -- answers: Q1=body phase (value_number), Q2=free text, Q3=tomorrow closure
  -- body phase を 1..5 散らして MoonPhase 各 phase の描画チェックも兼ねる
  insert into answers (entry_id, question_position, value_number, value_text) values
    -- -2 日: phase 2
    (e2_id, 1, 2, null),
    (e2_id, 2, null, '【2日前】会議で〇〇さんに言われた一言が、まだ引っかかってる。'),
    (e2_id, 3, null, '少し早めに寝る'),
    -- -3 日: phase 4
    (e3_id, 1, 4, null),
    (e3_id, 2, null, '【3日前】夕方の散歩で、空がやけに静かだった。'),
    (e3_id, 3, null, '本を1ページ読む'),
    -- -5 日: phase 1
    (e5_id, 1, 1, null),
    (e5_id, 2, null, '【5日前】締切に追われて、ごはんが砂を噛むようだった。'),
    (e5_id, 3, null, '深呼吸'),
    -- -7 日: phase 5(Stage 1 range 外、選ばれたらバグ)
    (e7_id, 1, 5, null),
    (e7_id, 2, null, '【7日前】これが Stage 1 で出たら off-by-one バグ。'),
    (e7_id, 3, null, '出ないはず');

  raise notice 'Seeded 4 entries for user %, entry_dates: %, %, %, %',
    uid, d7, d5, d3, d2;
  raise notice 'Now submit the 5th entry via /today UI, then check /today/done';
  raise notice 'Expected: CallbackCard with one of the [2日前 / 3日前 / 5日前] entries';
  raise notice 'Failure case: [7日前] entry appears => off-by-one in sliceRange()';
end;
$$;
