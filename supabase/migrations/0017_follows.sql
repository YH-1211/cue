-- フォロー機能: follows (公開ソーシャルグラフ)
--   follower_id が followee_id を片方向フォロー。複合主キーで重複防止。
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows(followee_id);
create index if not exists follows_follower_idx on public.follows(follower_id);

alter table public.follows enable row level security;

-- フォロー関係は公開 (誰でも閲覧可)
drop policy if exists "follows are public" on public.follows;
create policy "follows are public" on public.follows for select using (true);

-- 本人のみ自分の follow を作成
drop policy if exists "users insert own follow" on public.follows;
create policy "users insert own follow"
  on public.follows for insert with check (auth.uid() = follower_id);

-- 本人のみ自分の follow を削除
drop policy if exists "users delete own follow" on public.follows;
create policy "users delete own follow"
  on public.follows for delete using (auth.uid() = follower_id);
