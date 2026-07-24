-- 0039: 常設イベント (is_permanent)
--   ミュージアムの常設展など「終了日のない、ずっと開催しているもの」を表現する。
--   - is_permanent = true のイベントは終了日を持たず、表示側で「常設」ラベルを出す。
--   - effective_end を +infinity にして「これからのイベント (effective_end >= now)」
--     一覧から絶対に外れない (= ずっと表示される) ようにする。
--     これにより既存の一覧クエリ (.gte("effective_end", now)) は一切変更不要。

-- 1) フラグ列を追加
alter table public.events
  add column if not exists is_permanent boolean not null default false;

-- 2) effective_end を再定義する。
--    generated 列は式を後から変更できないため、drop → 再作成する。
--    (依存はインデックスのみ。ビュー等は無いので drop で問題ない)
alter table public.events drop column if exists effective_end;
alter table public.events
  add column effective_end timestamptz
  generated always as (
    case
      when is_permanent then 'infinity'::timestamptz
      else coalesce(ends_at, starts_at)
    end
  ) stored;
create index if not exists events_effective_end_idx
  on public.events(effective_end);

-- 3) 検索 RPC: 常設イベントは日付レンジ判定を素通りさせ、常に検索対象にする。
--    (常設は毎日開催しているので、どの日付フィルタでも「該当」とみなす)
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
    and (p_date_from is null or e.starts_at >= p_date_from or e.is_permanent)
    and (p_date_to is null or e.starts_at <= p_date_to or e.is_permanent)
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

-- 4) ファセット集計も常設を素通りさせて件数に含める。
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
      and (p_date_from is null or e.starts_at >= p_date_from or e.is_permanent)
      and (p_date_to is null or e.starts_at <= p_date_to or e.is_permanent)
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
