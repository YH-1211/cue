-- ランク制 & オンボーディング
--   1) profiles.onboarded_at: 初回オンボーディング完了時刻 (NULL = 未完了)
--   2) レポート投稿 (attended_events insert) で +5pt 加算
--      → ポイントの貯まり方を増やし、ランク (lib/rank.ts) が上がりやすくする。

-- =========================================================
-- onboarded_at
-- =========================================================
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- =========================================================
-- レポート投稿で +5pt
--   冪等性: point_transactions の unique (user_id, reason, ref_event_id) で
--   同じイベントへの二重加算を防ぐ。reason = 'report_posted'。
-- =========================================================
create or replace function public.award_points_on_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_transactions (user_id, delta, reason, ref_event_id)
  values (new.user_id, 5, 'report_posted', new.event_id)
  on conflict (user_id, reason, ref_event_id) do nothing;

  if found then
    update public.profiles
      set points = points + 5
      where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists attended_events_award_points on public.attended_events;
create trigger attended_events_award_points
  after insert on public.attended_events
  for each row
  execute function public.award_points_on_report();
