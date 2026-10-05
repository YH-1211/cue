-- 0050: 検索で地名 (会場名・エリア・住所) も対象にする + 関数の重複定義を解消する
--
-- 背景: search_events / search_event_facets には引数違いの同名関数が2つ存在していた。
--   - 0028 が p_food_stalls 付き (アプリが実際に呼ぶ方)
--   - 0039 が p_food_stalls 無しに is_permanent 対応を追加 (呼ばれていない方)
--   このため「常設」イベントが日付フィルタで除外され、検索に出てこなくなっていた。
--   古い方を drop して1つに統一し、取りこぼしを無くす。
--
-- 変更点:
--   1) 引数違いの古い定義を削除 (PostgREST の関数選択の曖昧さも解消)
--   2) 検索対象に venue_name / area / address を追加
--      → 「新宿」「渋谷」などの地名で、その会場のイベントが出るようになる
--   3) is_permanent の日付素通りを、アプリが呼ぶ方の定義に反映

-- 1) 古い引数セットの定義を削除する
drop function if exists public.search_events(
  text, text[], text[], timestamptz, timestamptz, boolean, boolean, text, int
);
drop function if exists public.search_event_facets(
  text, timestamptz, timestamptz, boolean, boolean
);

-- 2) 検索対象のテキストを組み立てるヘルパー。
--    タイトル・説明に加えて、会場名・エリア・住所も含める。
create or replace function public.event_search_text(e public.events)
returns text
language sql
immutable
as $$
  select concat_ws(' ',
    e.title,
    coalesce(e.description, ''),
    coalesce(e.venue_name, ''),
    coalesce(e.area, ''),
    coalesce(e.address, '')
  );
$$;

-- 3) 検索本体
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
    -- 常設イベントは毎日開催しているので、どの日付フィルタでも該当扱いにする
    and (p_date_from is null or e.starts_at >= p_date_from or e.is_permanent)
    and (p_date_to is null or e.starts_at <= p_date_to or e.is_permanent)
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
      -- タイプミス救済 (trigram)。会場名でも効かせる
      or e.title % p_q
      or coalesce(e.venue_name, '') % p_q
      -- 全トークンが「タイトル+説明+会場+エリア+住所」に含まれること
      or (
        select bool_and(public.event_search_text(e) ilike '%' || t || '%')
        from unnest(tokens.toks) as t
      )
    )
  order by
    case when p_sort = 'new' then e.created_at end desc,
    case
      when p_sort = 'relevant' and coalesce(p_q, '') <> ''
      then greatest(similarity(e.title, p_q), similarity(coalesce(e.venue_name, ''), p_q))
    end desc nulls last,
    e.starts_at asc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function public.search_events(
  text, text[], text[], timestamptz, timestamptz, boolean, boolean, boolean, text, int
) to anon, authenticated;

-- 4) ファセット集計も同じ検索条件にそろえる
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
      and (p_date_from is null or e.starts_at >= p_date_from or e.is_permanent)
      and (p_date_to is null or e.starts_at <= p_date_to or e.is_permanent)
      and (not p_free_only or e.is_free = true)
      and (not p_food_stalls or e.has_food_stalls = true)
      and (
        not p_evening_only
        or extract(hour from (e.starts_at at time zone 'Asia/Tokyo')) >= 18
      )
      and (
        coalesce(array_length(tokens.toks, 1), 0) = 0
        or e.title % p_q
        or coalesce(e.venue_name, '') % p_q
        or (
          select bool_and(public.event_search_text(e) ilike '%' || t || '%')
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

-- 5) 会場名のあいまい検索用インデックス (title は 0025 で作成済み)
create index if not exists events_venue_name_trgm_idx
  on public.events using gin (venue_name gin_trgm_ops);
