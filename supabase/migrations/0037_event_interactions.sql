-- イベントの計測（表示・公式サイト遷移・チケット遷移・共有）
-- 主催者向けにデータ提供するための匿名アクセスログ。
-- 個人は特定しない: user_id は持たず、重複除外用の匿名 session_id のみ保持する。

-- =========================================================
-- event_interactions: 匿名アクセスログ
-- =========================================================
create table public.event_interactions (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references public.events(id) on delete cascade,
  kind        text not null check (kind in ('view','official_click','ticket_click','share')),
  session_id  text,               -- 匿名のランダム Cookie 値。個人には紐付けない
  occurred_at timestamptz not null default now()
);

create index event_interactions_event_kind_idx on public.event_interactions(event_id, kind);
create index event_interactions_occurred_idx    on public.event_interactions(occurred_at);
-- view の重複除外を高速化（同一 session の直近閲覧チェック用）
create index event_interactions_dedupe_idx
  on public.event_interactions(event_id, session_id, kind, occurred_at);

-- =========================================================
-- RLS: 挿入のみ許可し、閲覧は誰にもさせない（集計は service role でのみ）
-- =========================================================
alter table public.event_interactions enable row level security;

-- 匿名/ログイン問わず、規定の kind のログのみ挿入できる。
-- （実際の挿入は /api/track が service role で行うが、多層防御として check を残す）
create policy "anyone can insert interaction logs"
  on public.event_interactions for insert
  with check (kind in ('view','official_click','ticket_click','share'));

-- select ポリシーは作らない = anon/authenticated からは読めない。
-- 管理画面の集計は service role（RLS バイパス）から行う。

-- =========================================================
-- 集計関数: イベントごとの指標を返す（管理画面用）
-- days = null で全期間、数値でその日数分に絞る
-- =========================================================
create or replace function public.get_event_stats(days int default null)
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
  where days is null or i.occurred_at >= now() - make_interval(days => days)
  group by i.event_id;
$$;
