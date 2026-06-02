-- 0025: 検索強化 (pg_trgm 全文検索 / is_free / 保存した検索 / ファセット集計)

-- 1) 部分一致・あいまい検索のための trigram 拡張とインデックス
create extension if not exists pg_trgm;

create index if not exists events_title_trgm_idx
  on public.events using gin (title gin_trgm_ops);
create index if not exists events_description_trgm_idx
  on public.events using gin (description gin_trgm_ops);

-- 2) 無料イベントフィルタ用カラム (null = 不明)
alter table public.events
  add column if not exists is_free boolean;

-- 3) 保存した検索条件 + 新着通知
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  q text,
  categories text[] not null default '{}',
  areas text[] not null default '{}',
  free_only boolean not null default false,
  evening_only boolean not null default false,
  notify boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_user_idx
  on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

drop policy if exists "users select own saved searches" on public.saved_searches;
create policy "users select own saved searches"
  on public.saved_searches for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own saved searches" on public.saved_searches;
create policy "users insert own saved searches"
  on public.saved_searches for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own saved searches" on public.saved_searches;
create policy "users update own saved searches"
  on public.saved_searches for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own saved searches" on public.saved_searches;
create policy "users delete own saved searches"
  on public.saved_searches for delete
  using (auth.uid() = user_id);

-- 4) 全文検索 RPC
--    q は空白でトークン分割し、全トークンが title OR description に含まれることを要求。
--    加えて title の trigram 類似 (% 演算子) でタイプミスにも対応。
create or replace function public.search_events(
  p_q text default null,
  p_categories text[] default '{}',
  p_areas text[] default '{}',
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_free_only boolean default false,
  p_evening_only boolean default false,
  p_sort text default 'soon',
  p_limit int default 50
)
returns setof public.events
language sql
stable
as $$
  with tokens as (
    select array_remove(
      string_to_array(lower(trim(coalesce(p_q, ''))), ' '),
      ''
    ) as toks
  )
  select e.*
  from public.events e, tokens
  where e.approved = true
    and (p_date_from is null or e.starts_at >= p_date_from)
    and (p_date_to is null or e.starts_at <= p_date_to)
    and (coalesce(array_length(p_categories, 1), 0) = 0 or e.category::text = any(p_categories))
    and (coalesce(array_length(p_areas, 1), 0) = 0 or e.area = any(p_areas))
    and (not p_free_only or e.is_free = true)
    and (
      not p_evening_only
      or extract(hour from (e.starts_at at time zone 'Asia/Tokyo')) >= 18
    )
    and (
      coalesce(array_length(tokens.toks, 1), 0) = 0
      or e.title % p_q
      or (
        select bool_and(
          (e.title || ' ' || coalesce(e.description, '')) ilike '%' || t || '%'
        )
        from unnest(tokens.toks) as t
      )
    )
  order by
    case when p_sort = 'new' then e.created_at end desc,
    case
      when p_sort = 'relevant' and coalesce(p_q, '') <> ''
      then similarity(e.title, p_q)
    end desc nulls last,
    e.starts_at asc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.search_events(
  text, text[], text[], timestamptz, timestamptz, boolean, boolean, text, int
) to anon, authenticated;

-- 5) ファセット集計 RPC
--    カテゴリ/エリアの選択は無視し、その他の条件下での件数を返す
--    (= 選んでも結果が0件にならない選択肢をユーザーに見せるため)
create or replace function public.search_event_facets(
  p_q text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_free_only boolean default false,
  p_evening_only boolean default false
)
returns jsonb
language sql
stable
as $$
  with tokens as (
    select array_remove(
      string_to_array(lower(trim(coalesce(p_q, ''))), ' '),
      ''
    ) as toks
  ),
  filtered as (
    select e.*
    from public.events e, tokens
    where e.approved = true
      and (p_date_from is null or e.starts_at >= p_date_from)
      and (p_date_to is null or e.starts_at <= p_date_to)
      and (not p_free_only or e.is_free = true)
      and (
        not p_evening_only
        or extract(hour from (e.starts_at at time zone 'Asia/Tokyo')) >= 18
      )
      and (
        coalesce(array_length(tokens.toks, 1), 0) = 0
        or e.title % p_q
        or (
          select bool_and(
            (e.title || ' ' || coalesce(e.description, '')) ilike '%' || t || '%'
          )
          from unnest(tokens.toks) as t
        )
      )
  ),
  cat as (
    select coalesce(jsonb_object_agg(category, c), '{}'::jsonb) as j
    from (select category::text as category, count(*) as c from filtered group by category) s
  ),
  area as (
    select coalesce(jsonb_object_agg(area, c), '{}'::jsonb) as j
    from (select area, count(*) as c from filtered where area is not null group by area) s
  )
  select jsonb_build_object('categories', cat.j, 'areas', area.j)
  from cat, area;
$$;

grant execute on function public.search_event_facets(
  text, timestamptz, timestamptz, boolean, boolean
) to anon, authenticated;
