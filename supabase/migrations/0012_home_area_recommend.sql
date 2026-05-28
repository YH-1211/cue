-- ===========================================
-- 0012: ホームエリア + 近隣マッチ通知 (Lv.2 Push レコメンド)
--   - 位置情報はテキスト (区名) のみ保存 / 緯度経度は持たない
--   - 半径 (km) は tokyo-areas.ts の代表点で近似マッチ
-- ===========================================

alter table public.profiles
  add column if not exists home_area text,
  add column if not exists home_radius_km integer not null default 5
    check (home_radius_km between 1 and 30),
  add column if not exists notify_nearby_match boolean not null default true;

comment on column public.profiles.home_area is
  '東京区名 (例: "渋谷"). null なら近隣マッチ通知は無効。';
comment on column public.profiles.home_radius_km is
  '近隣判定の半径 (km). 1〜30。';
comment on column public.profiles.notify_nearby_match is
  '日次の近隣マッチ通知を受け取るか。';
