-- 通知設定 + 送信ログ
-- 適用先: Supabase SQL Editor

-- =========================================================
-- profiles: 通知種別 ON/OFF
-- =========================================================
alter table public.profiles
  add column if not exists notify_interest_weekly boolean not null default true,
  add column if not exists notify_reminder_eve    boolean not null default true,
  add column if not exists notify_reminder_morning boolean not null default true,
  add column if not exists notify_ticket          boolean not null default true;

-- =========================================================
-- notification_log: 送信履歴 (重複送信防止)
-- =========================================================
create table if not exists public.notification_log (
  id             bigserial primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           text not null,   -- 'reminder_eve' | 'reminder_morning' | 'ticket_24h' | 'ticket_1h' | 'ticket_now' | 'interest_weekly' | 'test'
  event_id       uuid references public.events(id) on delete cascade,
  sent_at        timestamptz not null default now(),
  unique (user_id, kind, event_id)
);

create index if not exists notification_log_user_idx
  on public.notification_log(user_id);
create index if not exists notification_log_sent_at_idx
  on public.notification_log(sent_at desc);

alter table public.notification_log enable row level security;

-- 本人のみ閲覧可 (書き込みは service role のみ)
drop policy if exists "users view own notification log" on public.notification_log;
create policy "users view own notification log"
  on public.notification_log for select
  using (auth.uid() = user_id);
