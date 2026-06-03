-- 屋台 (露店・縁日) が出るイベントを絞り込むためのフラグ列。
--   null = 不明 / true = 屋台あり / false = 屋台なし。
--   「無料」フィルタ (is_free) と同じ方式で、検索 RPC のパラメータとして使う。
alter table public.events
  add column if not exists has_food_stalls boolean;

-- 0025 の search_events / search_event_facets に p_food_stalls を追加して再定義する。
create or replace function public.search_events(
  p_q text default null,
  p_categories text[] default '{}',
  p_areas text[] default '{}',
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_free_only boolean default false,
  p_evening_only boolean default false,
  p_food_stalls boolean default false,
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
    and (not p_food_stalls or e.has_food_stalls = true)
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
  text, text[], text[], timestamptz, timestamptz, boolean, boolean, boolean, text, int
) to anon, authenticated;

create or replace function public.search_event_facets(
  p_q text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_free_only boolean default false,
  p_evening_only boolean default false,
  p_food_stalls boolean default false
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
      and (not p_food_stalls or e.has_food_stalls = true)
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
  text, timestamptz, timestamptz, boolean, boolean, boolean
) to anon, authenticated;
