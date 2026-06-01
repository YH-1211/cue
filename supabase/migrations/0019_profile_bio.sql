-- D: プロフィール編集 — 自己紹介 (インスタ風)
alter table public.profiles
  add column if not exists bio text;

comment on column public.profiles.bio is 'プロフィールの自己紹介文 (最大160文字)';
