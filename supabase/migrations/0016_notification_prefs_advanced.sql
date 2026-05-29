-- #7 push 精度向上: 通知の詳細設定
--   - 静音時間 (深夜帯は通知しない)。JST の時刻 (0-23) で開始/終了を持つ。
--     start=22, end=7 なら 22:00〜翌07:00 は送らない。start=end なら無効。
--   - 興味マッチ (interest_weekly) の最小スコア閾値。保存履歴から学習したカテゴリ重みの下限。
alter table public.profiles
  add column if not exists notify_quiet_hours_start smallint not null default 22,
  add column if not exists notify_quiet_hours_end   smallint not null default 7,
  add column if not exists notify_quiet_hours_enabled boolean not null default true,
  add column if not exists notify_interest_min_score numeric not null default 1.0;

comment on column public.profiles.notify_quiet_hours_start is '静音時間の開始時刻 (JST 0-23)';
comment on column public.profiles.notify_quiet_hours_end is '静音時間の終了時刻 (JST 0-23)';
comment on column public.profiles.notify_quiet_hours_enabled is '静音時間を有効にするか';
comment on column public.profiles.notify_interest_min_score is 'interest_weekly の最小スコア閾値 (0.5=ゆるめ / 1.0=標準 / 2.0=厳しめ)';
