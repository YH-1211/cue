-- =========================================================
-- お問い合わせフォーム
-- =========================================================
-- 問い合わせ内容を contact_messages テーブルに保存する。
-- 送信は誰でも可（未ログインも可）。閲覧は管理者のみ（service role）。
-- =========================================================

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 100),
  email       text not null check (char_length(email) between 3 and 200),
  category    text not null default 'other'
                check (category in ('bug', 'request', 'event', 'account', 'other')),
  body        text not null check (char_length(body) between 1 and 4000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists contact_messages_created_idx
  on public.contact_messages(created_at desc);

alter table public.contact_messages enable row level security;

-- 送信（INSERT）は誰でも可。未ログインユーザーからの問い合わせも受け付ける。
drop policy if exists "anyone can submit contact message" on public.contact_messages;
create policy "anyone can submit contact message"
  on public.contact_messages for insert
  with check (true);

-- 閲覧・更新はRLSで一切許可しない（管理画面は service role 経由で読む）。
