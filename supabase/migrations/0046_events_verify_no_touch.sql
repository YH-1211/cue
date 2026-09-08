-- =========================================================
-- verified_at だけを更新したときは updated_at を動かさない
-- =========================================================
-- events は全 UPDATE で updated_at を now() にする共通トリガー
-- (touch_updated_at) が入っている。そのため 0045 で追加した verified_at に
-- 「確認したよ」の印を付けるだけでも updated_at が動いてしまい、
--   updated_at  = データが変わった日
--   verified_at = 内容が正しいと確認した日
-- という 0045 の区別が成立しなくなる。
--
-- events 専用のトリガー関数を用意し、verified_at 以外に差分が無い更新では
-- updated_at を据え置くようにする。
-- =========================================================

create or replace function public.touch_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- verified_at と updated_at を除いて比較し、実データに変更があるときだけ打刻する
  if (to_jsonb(new) - 'verified_at' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'verified_at' - 'updated_at')
  then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

comment on function public.touch_events_updated_at() is
  'events 用の updated_at 打刻。verified_at のみの更新 (確認したが内容は変更なし) では updated_at を動かさない。';

drop trigger if exists events_touch_updated_at on public.events;

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_events_updated_at();
