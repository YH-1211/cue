-- 興味タグに合うイベントの「開催が近づいた」「チケット発売」通知の ON/OFF
-- 適用先: Supabase SQL Editor
--
-- notify_interest_upcoming: 保存していなくても、興味タグに合うイベントの
--   開催が近づいたら (7日前 / 前日、花火は当日朝も) 通知する。
-- notify_interest_ticket:   興味タグに合うイベントのチケット発売開始 (24h前) を通知する。

alter table public.profiles
  add column if not exists notify_interest_upcoming boolean not null default true,
  add column if not exists notify_interest_ticket   boolean not null default true;
