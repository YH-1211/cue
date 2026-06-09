-- =========================================================
-- 画面から追加できる管理者 (admin_users)
-- =========================================================
-- 管理者判定は「ADMIN_EMAIL 環境変数 (ルート/削除不可) OR この表」。
-- メール単位で保持するので、まだサインアップしていないユーザーも
-- 事前に管理者として登録できる (ログイン時にメール一致で権限付与)。
-- 一覧/追加/削除は requireAdmin で守った server action から
-- service role で行う。通常ユーザーは「自分の行」だけ参照でき、
-- これは isAdmin() の判定に使う。
-- =========================================================

create table if not exists public.admin_users (
  email text primary key,
  added_by text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- 自分のメールに一致する行だけ参照可 (isAdmin の判定用)。
-- 他人の管理者状態は見えない (列挙防止)。
create policy "see own admin row"
  on public.admin_users
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
