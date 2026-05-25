-- =========================================================
-- profiles.interest_categories: 興味カテゴリ (text配列)
-- events.category と一致する値を格納 (art / music / drama / festival / food / seasonal / film / learning)
-- =========================================================
alter table public.profiles
  add column if not exists interest_categories text[] not null default '{}';
