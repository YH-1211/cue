-- ===========================================
-- 0009: event_sources (外部データ取り込み設定)
--   - 各データソース(RSS/Atom/JSON等)の URL とメタ情報を保持
--   - 取り込みは /api/cron/ingest が定期実行
-- ===========================================

create type ingest_kind as enum ('rss', 'atom', 'ical', 'json');

create table public.event_sources (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,                          -- 表示名 (例: "Peatix Tokyo")
  kind              ingest_kind not null,                   -- 形式
  url               text not null,                          -- フィード URL
  category_default  event_category not null,                -- 取り込み時のデフォルトカテゴリ
  area_default      text,                                   -- デフォルトエリア
  enabled           boolean not null default true,          -- 取り込み有効/無効
  auto_approve      boolean not null default false,         -- true なら approved=true で投入
  last_run_at       timestamptz,                            -- 最終実行時刻
  last_status       text,                                   -- 'ok' | 'error'
  last_count        integer,                                -- 直近で取り込んだ件数
  last_error        text,                                   -- エラー時のメッセージ (先頭500字)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index event_sources_enabled_idx on public.event_sources(enabled);

create trigger event_sources_touch_updated_at before update on public.event_sources
  for each row execute function public.touch_updated_at();

-- RLS: 一般ユーザーには公開しない (Service Role のみアクセス)
alter table public.event_sources enable row level security;
-- ポリシーを書かなければ全拒否。Service Role は RLS を無視するため問題なし。

-- ===========================================
-- 初期データ: 動作確認用 placeholder (disabled)
--   実 URL が決まったら enabled=true + url 更新で稼働
-- ===========================================
insert into public.event_sources (name, kind, url, category_default, area_default, enabled)
values
  ('Peatix Tokyo (placeholder)', 'atom', 'https://peatix.com/search.atom?country=JP&p=Tokyo', 'learning', '東京', false),
  ('connpass Tokyo (placeholder)', 'json', 'https://connpass.com/api/v1/event/?keyword=tokyo&count=50', 'learning', '東京', false);
