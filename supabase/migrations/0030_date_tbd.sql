-- 日程未定 (TBD) のイベントを許可する。
--   starts_at が NULL = 「日程未定」を表す。詳細が判明したら日時を埋めて公開リストに載る。
--   effective_end は coalesce(ends_at, starts_at) なので、両方 NULL のとき NULL になり、
--   「これからのイベント (effective_end >= now)」一覧からは自然に外れる。
--   未定イベントは一覧の専用セクションで別途表示する。
alter table public.events
  alter column starts_at drop not null;
