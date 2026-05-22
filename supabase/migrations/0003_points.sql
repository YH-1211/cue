-- =========================================================
-- ポイント機能
-- =========================================================
-- profiles.points: 累積ポイント残高
-- point_transactions: 加減算履歴 (冪等性は (user_id, reason, ref_event_id) の unique で担保)
-- =========================================================

alter table public.profiles
  add column if not exists points integer not null default 0;

create table if not exists public.point_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  delta         integer not null,
  reason        text not null,
  ref_event_id  uuid references public.events(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- 同じ理由・同じイベントでの二重加算を防ぐ
create unique index if not exists point_transactions_unique_reason_event
  on public.point_transactions (user_id, reason, ref_event_id)
  where ref_event_id is not null;

create index if not exists point_transactions_user_id_idx
  on public.point_transactions (user_id, created_at desc);

alter table public.point_transactions enable row level security;

-- 本人のみ自分の履歴を閲覧可
create policy "users view own point transactions"
  on public.point_transactions for select
  using (auth.uid() = user_id);

-- =========================================================
-- トリガー: events.approved が false -> true に変わったら +10pt
-- ユーザー投稿 (source_type='user') かつ submitted_by が非NULLのみ対象
-- =========================================================
create or replace function public.award_points_on_event_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved = true
     and (old.approved is distinct from true)
     and new.source_type = 'user'
     and new.submitted_by is not null
  then
    insert into public.point_transactions (user_id, delta, reason, ref_event_id)
    values (new.submitted_by, 10, 'event_approved', new.id)
    on conflict (user_id, reason, ref_event_id) do nothing;

    -- 実際に挿入された場合のみ profiles.points を加算
    if found then
      update public.profiles
        set points = points + 10
        where id = new.submitted_by;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_award_points on public.events;
create trigger events_award_points
  after update of approved on public.events
  for each row
  execute function public.award_points_on_event_approval();
