-- サイト全体のページ閲覧ログ
--
-- 既存の event_interactions は「イベント詳細ページ」でしか発火せず、
-- トップ / 一覧 / カレンダーの閲覧が一切記録されていなかった。
-- 広告からトップに着地した流入が数字に出ないため、全ページを対象にした
-- 素のページビューを別テーブルで持つ。
--
-- 個人は特定しない: user_id は持たず、event_interactions と同じ匿名 Cookie
-- (cue_sid) の値のみを session_id として保持する。
-- リファラは「ホスト名だけ」を保存し、URL 全体や検索語は保存しない。

create table public.page_views (
  id            bigint generated always as identity primary key,
  path          text not null,      -- クエリ文字列を除いたパス (例: /events)
  referrer_host text,               -- 流入元のホスト名のみ (例: t.co)。自サイト内遷移は null
  utm_source    text,               -- 広告計測用パラメータ
  utm_medium    text,
  utm_campaign  text,
  session_id    text,               -- 匿名のランダム Cookie 値。個人には紐付けない
  occurred_at   timestamptz not null default now()
);

create index page_views_occurred_idx on public.page_views(occurred_at);
create index page_views_path_idx     on public.page_views(path, occurred_at);
-- 流入元の集計用 (広告の効果測定)
create index page_views_source_idx
  on public.page_views(utm_source, occurred_at)
  where utm_source is not null;

-- =========================================================
-- RLS: event_interactions と同じ方針。挿入のみ許可し、閲覧はさせない。
-- 実際の挿入は /api/track が service role で行う (多層防御として policy を残す)
-- =========================================================
alter table public.page_views enable row level security;

create policy "anyone can insert page views"
  on public.page_views for insert
  with check (true);

-- select ポリシーは作らない = anon/authenticated からは読めない。
-- 集計は service role (RLS バイパス) から行う。

-- =========================================================
-- 集計関数: 日別のページビューとユニークセッション数を返す
-- days = 遡る日数
-- =========================================================
create or replace function public.get_page_view_stats(days int default 14)
returns table (
  day              date,
  views            bigint,
  unique_sessions  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (v.occurred_at at time zone 'Asia/Tokyo')::date as day,
    count(*)                                        as views,
    count(distinct v.session_id)                    as unique_sessions
  from public.page_views v
  where v.occurred_at >= now() - make_interval(days => days)
  group by 1
  order by 1 desc;
$$;
