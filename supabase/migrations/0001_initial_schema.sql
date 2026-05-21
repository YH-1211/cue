-- Cue 初期スキーマ (Phase 1 MVP)
-- 実行先: Supabase SQL Editor

-- =========================================================
-- ENUM 定義
-- =========================================================
create type event_category as enum (
  'art',       -- アート (展覧会、写真展、工芸)
  'music',     -- 音楽 (ライブ、フェス、クラシック)
  'theater',   -- 舞台 (演劇、歌舞伎、能、落語)
  'festival',  -- 祭り
  'food',      -- フード
  'seasonal',  -- 季節 (花見、花火、紅葉、初詣)
  'film',      -- 映像 (上映会、映画祭)
  'learning'   -- 学び (講演、ワークショップ)
);

create type event_source as enum (
  'api',   -- 公式API
  'rss',   -- 公式RSS
  'user'   -- ユーザー投稿
);

-- =========================================================
-- profiles: ユーザープロフィール
-- =========================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- auth.users 作成時に自動でprofileも作成する関数
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- tags: タグマスタ
-- =========================================================
create table public.tags (
  id       serial primary key,
  slug     text unique not null,
  name     text not null,
  category event_category,
  created_at timestamptz not null default now()
);

create index tags_category_idx on public.tags(category);

-- =========================================================
-- events: イベント情報
-- =========================================================
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  venue_name      text,
  address         text,
  lat             numeric(10, 7),
  lng             numeric(10, 7),
  area            text,                  -- 例: "新宿", "渋谷"
  category        event_category not null,
  cover_image_url text,
  official_url    text not null,         -- 公式URL必須
  ticket_sale_starts_at timestamptz,     -- チケット発売日時 (任意)
  source_type     event_source not null,
  source_id       text,                  -- API/RSS の元ID (重複防止)
  submitted_by    uuid references public.profiles(id) on delete set null,
  approved        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_type, source_id)
);

create index events_starts_at_idx       on public.events(starts_at);
create index events_category_idx        on public.events(category);
create index events_approved_idx        on public.events(approved);
create index events_ticket_sale_idx     on public.events(ticket_sale_starts_at)
  where ticket_sale_starts_at is not null;

-- =========================================================
-- event_tags: イベントとタグの中間テーブル
-- =========================================================
create table public.event_tags (
  event_id uuid not null references public.events(id) on delete cascade,
  tag_id   integer not null references public.tags(id) on delete cascade,
  primary key (event_id, tag_id)
);

create index event_tags_tag_id_idx on public.event_tags(tag_id);

-- =========================================================
-- user_interests: ユーザーの興味タグ
-- =========================================================
create table public.user_interests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag_id  integer not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);

-- =========================================================
-- saved_events: 行きたい登録 + 通知設定
-- =========================================================
create table public.saved_events (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  notify_ticket_24h     boolean not null default true,
  notify_ticket_1h      boolean not null default true,
  notify_ticket_now     boolean not null default true,
  notify_event_reminder boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- =========================================================
-- attended_events: 行った記録
-- =========================================================
create table public.attended_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  memo        text,
  rating      smallint check (rating between 1 and 5),
  attended_on date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, event_id)
);

create index attended_events_user_id_idx     on public.attended_events(user_id);
create index attended_events_attended_on_idx on public.attended_events(attended_on);

-- =========================================================
-- attended_photos: 行ったイベントの写真
-- =========================================================
create table public.attended_photos (
  id                 uuid primary key default gen_random_uuid(),
  attended_event_id  uuid not null references public.attended_events(id) on delete cascade,
  storage_path       text not null,          -- Supabase Storage のパス
  caption            text,
  created_at         timestamptz not null default now()
);

create index attended_photos_event_idx on public.attended_photos(attended_event_id);

-- =========================================================
-- push_subscriptions: Web Push 購読
-- =========================================================
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- =========================================================
-- updated_at 自動更新トリガー
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at        before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger events_touch_updated_at          before update on public.events
  for each row execute function public.touch_updated_at();
create trigger attended_events_touch_updated_at before update on public.attended_events
  for each row execute function public.touch_updated_at();

-- =========================================================
-- Row Level Security (RLS) を有効化
-- =========================================================
alter table public.profiles           enable row level security;
alter table public.events             enable row level security;
alter table public.tags               enable row level security;
alter table public.event_tags         enable row level security;
alter table public.user_interests     enable row level security;
alter table public.saved_events       enable row level security;
alter table public.attended_events    enable row level security;
alter table public.attended_photos    enable row level security;
alter table public.push_subscriptions enable row level security;

-- =========================================================
-- profiles ポリシー
-- =========================================================
create policy "profiles are viewable by anyone"
  on public.profiles for select using (true);

create policy "users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- =========================================================
-- events ポリシー
-- =========================================================
-- 承認済みは全員閲覧可
create policy "approved events are public"
  on public.events for select using (approved = true);
-- 未承認は投稿者本人のみ閲覧可
create policy "users can view own pending events"
  on public.events for select using (auth.uid() = submitted_by);
-- ログインユーザーは投稿可 (要承認)
create policy "authenticated users can submit events"
  on public.events for insert
  with check (auth.uid() = submitted_by and source_type = 'user');
-- 投稿者本人は自分の未承認イベントを更新可
create policy "users can update own pending events"
  on public.events for update
  using (auth.uid() = submitted_by and approved = false);

-- =========================================================
-- tags ポリシー (読み取り全員、書き込みは将来の管理者)
-- =========================================================
create policy "tags are viewable by anyone"
  on public.tags for select using (true);

-- =========================================================
-- event_tags ポリシー
-- =========================================================
create policy "event_tags are viewable by anyone"
  on public.event_tags for select using (true);

-- =========================================================
-- user_interests ポリシー (本人のみ)
-- =========================================================
create policy "users manage own interests"
  on public.user_interests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- saved_events ポリシー (本人のみ)
-- =========================================================
create policy "users manage own saved events"
  on public.saved_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- attended_events ポリシー (本人のみ)
-- =========================================================
create policy "users manage own attended events"
  on public.attended_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- attended_photos ポリシー (本人の attended_event に紐付くもののみ)
-- =========================================================
create policy "users manage photos of own attended events"
  on public.attended_photos for all
  using (
    exists (
      select 1 from public.attended_events ae
      where ae.id = attended_photos.attended_event_id
        and ae.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.attended_events ae
      where ae.id = attended_photos.attended_event_id
        and ae.user_id = auth.uid()
    )
  );

-- =========================================================
-- push_subscriptions ポリシー (本人のみ)
-- =========================================================
create policy "users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- 初期データ: タグマスタ
-- =========================================================
insert into public.tags (slug, name, category) values
  ('cherry-blossom', '桜',          'seasonal'),
  ('fireworks',      '花火',        'seasonal'),
  ('autumn-leaves',  '紅葉',        'seasonal'),
  ('new-year',       '初詣',        'seasonal'),
  ('contemporary-art','現代アート',  'art'),
  ('photography',    '写真展',      'art'),
  ('craft',          '工芸',        'art'),
  ('jazz',           'ジャズ',      'music'),
  ('classical',      'クラシック',  'music'),
  ('rock',           'ロック',      'music'),
  ('festival-music', '音楽フェス',  'music'),
  ('drama',          '演劇',        'theater'),
  ('kabuki',         '歌舞伎',      'theater'),
  ('noh',            '能',          'theater'),
  ('rakugo',         '落語',        'theater'),
  ('shrine-festival','神社例大祭',  'festival'),
  ('local-festival', '地域祭り',    'festival'),
  ('food-festival',  'フードフェス','food'),
  ('beer-festival',  'ビアフェス',  'food'),
  ('screening',      '上映会',      'film'),
  ('film-festival',  '映画祭',      'film'),
  ('lecture',        '講演',        'learning'),
  ('workshop',       'ワークショップ','learning')
on conflict (slug) do nothing;
