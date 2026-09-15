-- get_event_stats を「日数」から「起点時刻」指定に変更する
--
-- 旧: get_event_stats(days int) は now() - N日 のローリング集計しかできず、
--     「本日(日本時間0時から今まで)」を出せなかった。
-- 新: 起点の timestamptz を呼び出し側から渡す。日本時間の日付境界は
--     アプリ側で算出して渡す。since = null で全期間。
--
-- 引数の型が変わると同名関数が2つ並んで曖昧になるため、旧定義は drop する。

drop function if exists public.get_event_stats(int);

create or replace function public.get_event_stats(since timestamptz default null)
returns table (
  event_id        uuid,
  views           bigint,
  unique_views    bigint,
  official_clicks bigint,
  ticket_clicks   bigint,
  shares          bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.event_id,
    count(*) filter (where i.kind = 'view')                        as views,
    count(distinct i.session_id) filter (where i.kind = 'view')    as unique_views,
    count(*) filter (where i.kind = 'official_click')              as official_clicks,
    count(*) filter (where i.kind = 'ticket_click')                as ticket_clicks,
    count(*) filter (where i.kind = 'share')                       as shares
  from public.event_interactions i
  where since is null or i.occurred_at >= since
  group by i.event_id;
$$;
