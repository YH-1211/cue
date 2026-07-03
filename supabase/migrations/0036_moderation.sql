-- =========================================================
-- ユーザーモデレーション (警告 / ブロック / 削除 + 通報 + 監査ログ)
-- =========================================================
-- 目的:
--   利用者が増えたときに、荒らし/アンチコメント等へ対処できる管理機能を追加する。
--   1) profiles に状態列 (active / warned / banned) と理由・日時を持たせる
--   2) コメントの通報を受け付ける comment_reports テーブル
--   3) 管理者の操作履歴を残す admin_actions テーブル (誰がいつ誰に何をしたか)
--
-- 書き込みは全て requireAdmin で守った server action から service role で行う。
-- 通常ユーザーは status を自分で変更できない (0034 と同様に列単位 grant で防ぐ)。
-- =========================================================

-- ---------------------------------------------------------
-- 1) profiles: モデレーション状態
-- ---------------------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'warned', 'banned')),
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by text;

-- status 等はクライアントから更新させない。
-- 0034 でテーブル全体 UPDATE を剥奪し列単位 grant にしてあるため、
-- ここで新列を grant しなければ authenticated からは書けない (= 管理者の
-- service role 経由のみ)。念のため何もしない (grant を追加しない) 方針。

-- banned ユーザーの投稿・コメントを DB 側でも止める堅牢化。
-- (アプリ側でも弾くが、二重の防御として RLS の insert に status 判定を足す)
-- attended_comments の insert ポリシーを status='banned' 以外に限定。
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attended_comments'
      and policyname = 'authenticated can insert own comment'
  ) then
    drop policy "authenticated can insert own comment" on public.attended_comments;
  end if;
end $$;

create policy "authenticated can insert own comment"
  on public.attended_comments
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'banned'
    )
  );

-- ---------------------------------------------------------
-- 2) コメント通報 (comment_reports)
-- ---------------------------------------------------------
create table if not exists public.comment_reports (
  id           uuid primary key default gen_random_uuid(),
  comment_id   uuid not null references public.attended_comments(id) on delete cascade,
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  reason       text check (char_length(reason) <= 300),
  status       text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  -- 同じ人が同じコメントを重複通報できない
  unique (comment_id, reporter_id)
);

create index if not exists comment_reports_status_idx
  on public.comment_reports (status, created_at desc);

alter table public.comment_reports enable row level security;

-- ログインユーザーは自分の通報を作成できる (banned は不可)。
create policy "authenticated can report a comment"
  on public.comment_reports
  for insert
  to authenticated
  with check (
    auth.uid() = reporter_id
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'banned'
    )
  );

-- 一覧/更新は service role (管理 server action) のみ。
-- select ポリシーを置かない = 通常ユーザーは他人の通報を見られない。

-- ---------------------------------------------------------
-- 3) 管理者操作の監査ログ (admin_actions)
-- ---------------------------------------------------------
-- 誰が (actor_email) いつ 誰に/何に対して (target_*) 何を (action) したか。
create table if not exists public.admin_actions (
  id             uuid primary key default gen_random_uuid(),
  actor_email    text not null,
  action         text not null, -- 'warn_user' | 'ban_user' | 'unban_user' | 'delete_user' | 'resolve_report' | 'dismiss_report' | 'delete_comment' 等
  target_user_id uuid,          -- 対象ユーザー (削除で auth.users ごと消える場合は履歴として残す)
  target_type    text,          -- 'user' | 'comment' | 'report' | 'event'
  target_id      text,          -- 対象の id (uuid を文字列で)
  detail         text,          -- 理由やメモ
  created_at     timestamptz not null default now()
);

create index if not exists admin_actions_created_idx
  on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;
-- ポリシーを置かない = 通常ユーザーは参照/書き込み不可。
-- 記録・参照は service role (管理 server action) からのみ。
