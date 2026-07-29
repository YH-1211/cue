-- ===========================================
-- 0041: LINE Messaging API 連携
--   - profiles.line_user_id: LINE の userId (U から始まる 33 文字)。
--     友だち連携が完了したユーザーだけ埋まる。null なら LINE 配信しない。
--   - line_link_codes: Cue アカウントと LINE 友だちを紐付けるための一時コード。
--     ログイン済ユーザーが発行し、LINE で bot に送ることで照合する。
-- ===========================================

alter table public.profiles
  add column if not exists line_user_id text unique,
  add column if not exists notify_via_line boolean not null default true;

comment on column public.profiles.line_user_id is
  'LINE Messaging API の userId。友だち連携済みのユーザーのみ。null なら LINE 配信対象外。';
comment on column public.profiles.notify_via_line is
  'LINE 経由で通知を受け取るか。連携していても個別にオフにできる。';

create table if not exists public.line_link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

comment on table public.line_link_codes is
  'LINE 友だち連携用の一時コード。ユーザーが発行し bot に送信して照合する。';

create index if not exists line_link_codes_user_idx
  on public.line_link_codes (user_id);

-- コードは本人のみ発行・参照。照合 (used_at 更新) は Webhook が service_role で行う。
alter table public.line_link_codes enable row level security;

drop policy if exists "own link codes" on public.line_link_codes;
create policy "own link codes" on public.line_link_codes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
