-- ===========================================
-- 0014: cron_run_logs — Cron 実行履歴ログ
--   - ingest / notify 等の Cron 実行結果を 1 行/回 で保存
--   - event_sources.last_* は最新スナップショットだけ持つので、履歴用に別テーブルを作る
--   - 集計はサービスロール (admin client) からのみアクセス。RLS は有効化するが公開ポリシーは作らない
-- ===========================================

create table if not exists public.cron_run_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb,
  error text
);

create index if not exists cron_run_logs_kind_started_at_idx
  on public.cron_run_logs (kind, started_at desc);

alter table public.cron_run_logs enable row level security;

-- 公開 SELECT ポリシーは敢えて作らない。
-- admin client (service role) は RLS をバイパスするので、サーバー側からのみ参照する。
