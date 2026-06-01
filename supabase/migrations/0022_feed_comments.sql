-- フィード: 「行ってきた」レポートへのコメント
--   attended_likes と同じ構造。comment_count を集計キャッシュとして持つ。

-- =========================================================
-- attended_events に comment_count を追加
-- =========================================================
alter table public.attended_events
  add column if not exists comment_count integer not null default 0;

-- =========================================================
-- attended_comments: レポートへのコメント
-- =========================================================
create table if not exists public.attended_comments (
  id                uuid primary key default gen_random_uuid(),
  attended_event_id uuid not null references public.attended_events(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  body              text not null check (char_length(body) between 1 and 500),
  created_at        timestamptz not null default now()
);

create index if not exists attended_comments_event_idx
  on public.attended_comments(attended_event_id, created_at);

alter table public.attended_comments enable row level security;

-- コメントは全員閲覧可
drop policy if exists "attended_comments are viewable by anyone" on public.attended_comments;
create policy "attended_comments are viewable by anyone"
  on public.attended_comments for select using (true);

-- 本人のみ作成可
drop policy if exists "users insert own comment" on public.attended_comments;
create policy "users insert own comment"
  on public.attended_comments for insert
  with check (auth.uid() = user_id);

-- 本人のみ削除可
drop policy if exists "users delete own comment" on public.attended_comments;
create policy "users delete own comment"
  on public.attended_comments for delete
  using (auth.uid() = user_id);

-- =========================================================
-- comment_count を自動更新するトリガー
-- =========================================================
create or replace function public.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.attended_events
      set comment_count = comment_count + 1
      where id = new.attended_event_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.attended_events
      set comment_count = greatest(0, comment_count - 1)
      where id = old.attended_event_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists attended_comments_count_ins on public.attended_comments;
create trigger attended_comments_count_ins
  after insert on public.attended_comments
  for each row execute function public.bump_comment_count();

drop trigger if exists attended_comments_count_del on public.attended_comments;
create trigger attended_comments_count_del
  after delete on public.attended_comments
  for each row execute function public.bump_comment_count();
