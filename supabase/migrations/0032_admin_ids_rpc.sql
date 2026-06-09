-- =========================================================
-- メールアドレスから auth.users の id を引く RPC
-- =========================================================
-- 管理者（ADMIN_EMAIL）への通知送信などで、メールアドレスから
-- ユーザー id を解決するために使う。auth.users は PostgREST から
-- 直接読めないため security definer 関数で包む。
-- service role からのみ呼ぶ想定（anon/authenticated には付与しない）。
-- =========================================================

create or replace function public.user_ids_by_email(p_emails text[])
returns table (id uuid)
language sql
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where lower(u.email) = any (
    select lower(e) from unnest(p_emails) as e
  );
$$;

revoke all on function public.user_ids_by_email(text[]) from public, anon, authenticated;
grant execute on function public.user_ids_by_email(text[]) to service_role;
