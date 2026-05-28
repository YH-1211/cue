-- ===========================================
-- 0011: news_items + event_sources.target_table
--   - イベント(開催日)とニュース(公開日)を別テーブルで管理
--   - event_sources は target_table で振り分け
-- ===========================================

-- 1) news_items テーブル
create table public.news_items (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  summary         text,                                -- 抜粋 (本文は持たない)
  source_name     text not null,                       -- 例: "音楽ナタリー"
  source_url      text not null,                       -- 元記事 URL
  category        event_category not null,             -- カテゴリ (events と共通 enum)
  image_url       text,                                -- サムネ (あれば)
  published_at    timestamptz not null,                -- 公開日時
  source_type     event_source not null default 'rss', -- 'rss'/'api' (source_type は既存 enum を再利用)
  source_id       text not null,                       -- 元 ID/URL (重複防止)
  created_at      timestamptz not null default now(),
  unique (source_type, source_id)
);

create index news_items_published_at_idx on public.news_items(published_at desc);
create index news_items_category_idx     on public.news_items(category);

-- RLS: 読み取りは全員、書き込みは Service Role のみ
alter table public.news_items enable row level security;

create policy "news are public"
  on public.news_items for select using (true);

-- ===========================================
-- 2) event_sources に target_table 列を追加
--    'events' (デフォルト) or 'news_items'
-- ===========================================
create type ingest_target as enum ('events', 'news_items');

alter table public.event_sources
  add column target_table ingest_target not null default 'events';

comment on column public.event_sources.target_table is
  'どのテーブルに取り込むか。events=開催日基準, news_items=公開日基準';

-- ===========================================
-- 3) 古いニュースを掃除する関数 (cron から呼ぶ用)
-- ===========================================
create or replace function public.purge_old_news(days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.news_items
  where published_at < now() - (days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
