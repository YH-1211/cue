-- 表示設定 (テーマ / アクセントカラー) を端末間で同期するための列。
--
-- これまでは localStorage のみ (端末ごと) だったが、ログインユーザーは
-- DB に保存して別端末でも同じ見た目を再現できるようにする。
-- ゲストは引き続き localStorage のみ。
--
-- 注意: 0034 で profiles の UPDATE 権限を列単位に絞ったため、
--   新しい列もクライアント(authenticated)から更新できるよう明示的に GRANT する。
-- =========================================================

alter table public.profiles
  add column if not exists theme text not null default 'system',
  add column if not exists accent text not null default 'violet';

-- 不正値を弾く (アプリ側 validate との二重防御)。再適用しても安全なよう存在チェック。
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_theme_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_check
      check (theme in ('light', 'dark', 'system'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_accent_check'
  ) then
    alter table public.profiles
      add constraint profiles_accent_check
      check (accent in ('violet', 'orange', 'blue', 'teal', 'pink', 'green'));
  end if;
end $$;

-- RLS (auth.uid() = id) の下で本人だけが自分の表示設定を更新できる。
grant update (theme, accent) on public.profiles to authenticated;
