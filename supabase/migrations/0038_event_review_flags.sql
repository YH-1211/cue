-- =========================================================
-- イベント要確認フラグ (日次ヘルスチェック cron が書き込む)
-- =========================================================
-- 毎日の healthcheck cron が各イベントの official_url を叩き、
--   - dead_link:     公式URLが 404 / 5xx / タイムアウト
--   - date_mismatch: 公式ページの JSON-LD (schema.org Event.startDate) と
--                    DB の starts_at の「日付」が食い違う
--   - stale_soon:    開催が近い (14日以内) のに更新が古い (updated_at が古い)
--   - date_tbd:      日程未定 (starts_at が null)
-- を検出し、このテーブルに記録する。管理画面 /admin/reviews で確認する。
--
-- 1 イベント × 1 理由につき 1 行 (unique)。再検出時は last_seen_at / detail を更新。
-- open のまま次回の実行で検出されなくなったフラグは cron が自動で resolved にする
-- (公式URLが復活した / 日付を直した 等)。閲覧・更新は service role 経由のみ。
-- =========================================================

create table if not exists public.event_review_flags (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  reason        text not null
                  check (reason in ('dead_link', 'date_mismatch', 'stale_soon', 'date_tbd')),
  severity      text not null default 'warning'
                  check (severity in ('info', 'warning', 'critical')),
  detail        text,          -- 検出内容の説明 (例: "公式:2026-08-08 / DB:2026-08-15")
  detected_url  text,          -- チェックした official_url
  status        text not null default 'open'
                  check (status in ('open', 'resolved', 'ignored')),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  resolved_at   timestamptz,
  unique (event_id, reason)
);

create index if not exists event_review_flags_status_idx
  on public.event_review_flags(status, severity, last_seen_at desc);

create index if not exists event_review_flags_event_idx
  on public.event_review_flags(event_id);

alter table public.event_review_flags enable row level security;
-- 閲覧・更新はRLSで一切許可しない (管理画面・cron は service role 経由で読み書きする)。
