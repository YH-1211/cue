import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EventCover } from "@/components/event-cover";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  categoriesUnderParent,
  eventScheduleLabel,
  isEventCategory,
  isParentCategory,
  type EventCategory,
} from "@/lib/events";
import { AREA_COORDS, type AreaName } from "@/lib/tokyo-areas";
import { startOfTodayJstIso } from "@/lib/datetime";
import { EventsFilters } from "@/app/events/filters";
import { NearbyClient, type MapEvent } from "@/app/nearby/nearby-client";
import { SaveSearchBar } from "./save-search-bar";
import { cn } from "@/lib/utils";

export const metadata = { title: "検索" };

function isAreaName(s: string | null | undefined): s is AreaName {
  return !!s && s in AREA_COORDS;
}

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  has_food_stalls: boolean | null;
  ends_at: string | null;
};

type SearchParams = {
  q?: string;
  date?: string;
  category?: string;
  areas?: string;
  sort?: string;
  view?: string;
  free?: string;
  evening?: string;
  food?: string;
};

type Facets = {
  categories: Record<string, number>;
  areas: Record<string, number>;
};

function resolveDateRange(preset: string | undefined): {
  from?: string;
  to?: string;
} {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jstNow.getUTCFullYear();
  const m = jstNow.getUTCMonth();
  const d = jstNow.getUTCDate();

  function jstDateToUtc(year: number, month: number, day: number, hour = 0) {
    return new Date(Date.UTC(year, month, day, hour - 9, 0, 0, 0));
  }

  if (preset === "today") {
    return {
      from: jstDateToUtc(y, m, d, 0).toISOString(),
      to: jstDateToUtc(y, m, d + 1, 0).toISOString(),
    };
  }
  if (preset === "weekend") {
    const dow = jstNow.getUTCDay();
    const daysUntilSat = (6 - dow + 7) % 7;
    return {
      from: jstDateToUtc(y, m, d + daysUntilSat, 0).toISOString(),
      to: jstDateToUtc(y, m, d + daysUntilSat + 2, 0).toISOString(),
    };
  }
  if (preset === "month") {
    return {
      from: jstDateToUtc(y, m, d, 0).toISOString(),
      to: jstDateToUtc(y, m + 1, 1, 0).toISOString(),
    };
  }
  return {};
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const datePreset = sp.date ?? "";
  const sort = sp.sort ?? "";
  const view = sp.view === "map" ? "map" : "list";
  const freeOnly = sp.free === "1";
  const eveningOnly = sp.evening === "1";
  const foodStallsOnly = sp.food === "1";
  const activeCategory =
    sp.category && isEventCategory(sp.category) ? sp.category : null;
  const areas = (sp.areas ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasFilter =
    !!q ||
    !!datePreset ||
    !!activeCategory ||
    areas.length > 0 ||
    freeOnly ||
    eveningOnly ||
    foodStallsOnly;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const loggedIn = !!user;

  // 地図ビュー用: 座標つきの今後のイベントとユーザーのホームエリアを取得
  let mapEvents: MapEvent[] = [];
  let homeArea: AreaName | null = null;
  if (view === "map") {
    const { data: rows } = await supabase
      .from("events")
      .select("id, title, area, starts_at, lat, lng")
      .eq("approved", true)
      .gte("effective_end", startOfTodayJstIso())
      .not("lat", "is", null)
      .not("lng", "is", null)
      .limit(1000);
    mapEvents = (rows ?? [])
      .map((r) => r as MapEvent)
      .filter((r) => typeof r.lat === "number" && typeof r.lng === "number");
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("home_area")
        .eq("id", user.id)
        .maybeSingle();
      if (isAreaName(profile?.home_area)) homeArea = profile.home_area;
    }
  }

  let events: EventRow[] = [];
  let errorMessage: string | null = null;
  let facets: Facets = { categories: {}, areas: {} };

  // 条件が何も無いときはクエリしない (一覧目的なら /events へ誘導)
  if (view === "list" && hasFilter) {
    const { from: dateFrom, to: dateTo } = resolveDateRange(datePreset);
    const baseFrom = dateFrom ?? startOfTodayJstIso();

    // 親カテゴリは配下のサブカテゴリ全てに展開して RPC へ渡す
    const categoryList = activeCategory
      ? isParentCategory(activeCategory)
        ? categoriesUnderParent(activeCategory)
        : [activeCategory]
      : [];

    // 並び替え: 新着順は new、キーワード有り(既定)は関連度順、それ以外は開催が近い順。
    // 人気順は近い順で取得してから保存数で並べ替える。
    const rpcSort =
      sort === "new" ? "new" : q && sort !== "popular" ? "relevant" : "soon";

    const [{ data, error }, { data: facetData }] = await Promise.all([
      supabase.rpc("search_events", {
        p_q: q || null,
        p_categories: categoryList,
        p_areas: areas,
        p_date_from: baseFrom,
        p_date_to: dateTo ?? null,
        p_free_only: freeOnly,
        p_evening_only: eveningOnly,
        p_food_stalls: foodStallsOnly,
        p_sort: rpcSort,
        p_limit: 50,
      }),
      supabase.rpc("search_event_facets", {
        p_q: q || null,
        p_date_from: baseFrom,
        p_date_to: dateTo ?? null,
        p_free_only: freeOnly,
        p_evening_only: eveningOnly,
        p_food_stalls: foodStallsOnly,
      }),
    ]);

    events = (data ?? []) as EventRow[];
    errorMessage = error?.message ?? null;
    if (facetData) facets = facetData as Facets;

    // 人気順: 取得済みイベントの「行きたい」保存数で降順に並べ替える
    if (sort === "popular" && events.length > 0) {
      const ids = events.map((e) => e.id);
      const { data: saves } = await supabase
        .from("saved_events")
        .select("event_id")
        .in("event_id", ids);
      const counts = new Map<string, number>();
      for (const s of saves ?? []) {
        counts.set(s.event_id, (counts.get(s.event_id) ?? 0) + 1);
      }
      events = [...events].sort((a, b) => {
        const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
        if (diff !== 0) return diff;
        return a.starts_at.localeCompare(b.starts_at);
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">検索</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          キーワード・日付・カテゴリで絞り込むか、地図で近くを探せます。
        </p>
      </header>

      {/* 表示切り替え: リスト / 地図 */}
      <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
        <Link
          href="/search"
          className={cn(
            "rounded-md px-4 py-1.5 transition-colors",
            view === "list"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          リストで絞り込み
        </Link>
        <Link
          href="/search?view=map"
          className={cn(
            "rounded-md px-4 py-1.5 transition-colors",
            view === "map"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          地図で近くを探す
        </Link>
      </div>

      {view === "map" ? (
        <NearbyClient homeArea={homeArea} mapEvents={mapEvents} />
      ) : (
        <SearchListView
          hasFilter={hasFilter}
          errorMessage={errorMessage}
          events={events}
          facets={facets}
          loggedIn={loggedIn}
        />
      )}
    </div>
  );
}

function SearchListView({
  hasFilter,
  errorMessage,
  events,
  facets,
  loggedIn,
}: {
  hasFilter: boolean;
  errorMessage: string | null;
  events: EventRow[];
  facets: Facets;
  loggedIn: boolean;
}) {
  return (
    <>
      <div className="mb-4">
        <EventsFilters basePath="/search" facets={facets} />
      </div>

      {hasFilter && (
        <div className="mb-6">
          <SaveSearchBar loggedIn={loggedIn} />
        </div>
      )}

      {!hasFilter ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          上のフォームから条件を選んでください。
          <br />
          ぶらっと眺めたいときは
          <Link
            href="/events"
            className="ml-1 text-foreground underline underline-offset-2"
          >
            イベント一覧
          </Link>
          へどうぞ。
        </div>
      ) : errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          検索エラー: {errorMessage}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          条件に合うイベントが見つかりませんでした。
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {events.length} 件{events.length >= 50 && " (上限)"}
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="group block focus:outline-none"
                >
                  <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
                    <EventCover
                      coverImageUrl={event.cover_image_url}
                      title={event.title}
                      category={event.category}
                      hasFoodStalls={event.has_food_stalls}
                      className="h-40 w-full"
                    />
                    <CardContent className="flex flex-col gap-2 p-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={categoryBadgeClass(event.category)}
                        >
                          {CATEGORY_LABELS[event.category]}
                        </Badge>
                        {(() => {
                          const s = eventScheduleLabel(
                            event.starts_at,
                            event.ends_at
                          );
                          return (
                            <time
                              className={`text-xs ${
                                s.ongoing
                                  ? "font-medium text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {s.text}
                            </time>
                          );
                        })()}
                      </div>
                      <h2 className="line-clamp-2 text-base font-semibold leading-snug">
                        {event.title}
                      </h2>
                      {(event.venue_name || event.area) && (
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          {event.area && `${event.area} / `}
                          {event.venue_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
