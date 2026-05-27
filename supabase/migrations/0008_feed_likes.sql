-- フィード: 「行ってきた」レポートへのいいね
-- 適用先: Supabase SQL Editor

-- =========================================================
-- attended_events に like_count を追加 (集計キャッシュ)
-- =========================================================
alter table public.attended_events
  add column if not exists like_count integer not null default 0;

-- =========================================================
-- attended_likes: ユーザー × レポートのいいね中間
-- =========================================================
create table if not exists public.attended_likes (
  user_id           uuid not null references public.profiles(id) on delete cascade,
  attended_event_id uuid not null references public.attended_events(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (user_id, attended_event_id)
);

create index if not exists attended_likes_event_idx
  on public.attended_likes(attended_event_id);

alter table public.attended_likes enable row level security;

-- いいねは全員閲覧可 (誰がいいねしたかは表示しないが、count 計算で使う)
drop policy if exists "attended_likes are viewable by anyone" on public.attended_likes;
create policy "attended_likes are viewable by anyone"
  on public.attended_likes for select using (true);

-- 本人のみ追加/削除可
drop policy if exists "users insert own like" on public.attended_likes;
create policy "users insert own like"
  on public.attended_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "users delete own like" on public.attended_likes;
create policy "users delete own like"
  on public.attended_likes for delete
  using (auth.uid() = user_id);

-- =========================================================
-- like_count を自動更新するトリガー
-- =========================================================
create or replace function public.bump_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.attended_events
      set like_count = like_count + 1
      where id = new.attended_event_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.attended_events
      set like_count = greatest(0, like_count - 1)
      where id = old.attended_event_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists attended_likes_count_ins on public.attended_likes;
create trigger attended_likes_count_ins
  after insert on public.attended_likes
  for each row execute function public.bump_like_count();

drop trigger if exists attended_likes_count_del on public.attended_likes;
create trigger attended_likes_count_del
  after delete on public.attended_likes
  for each row execute function public.bump_like_count();
