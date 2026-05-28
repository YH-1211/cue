import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CATEGORY_LABELS,
  formatEventDateTime,
  isEventCategory,
  type EventCategory,
} from "@/lib/events";
import { EventsFilters } from "@/app/events/filters";

export const metadata = { title: "検索" };

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
};

type SearchParams = {
  q?: string;
  date?: string;
  category?: string;
  areas?: string;
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
  const activeCategory =
    sp.category && isEventCategory(sp.category) ? sp.category : null;
  const areas = (sp.areas ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasFilter =
    !!q || !!datePreset || !!activeCategory || areas.length > 0;

  const supabase = await createClient();

  let events: EventRow[] = [];
  let errorMessage: string | null = null;

  // 条件が何も無いときはクエリしない (一覧目的なら /events へ誘導)
  if (hasFilter) {
    const { from: dateFrom, to: dateTo } = resolveDateRange(datePreset);
    const baseFrom = dateFrom ?? new Date().toISOString();

    let query = supabase
      .from("events")
      .select(
        "id, title, starts_at, venue_name, area, category, cover_image_url"
      )
      .eq("approved", true)
      .gte("starts_at", baseFrom)
      .order("starts_at", { ascending: true })
      .limit(50);

    if (dateTo) query = query.lt("starts_at", dateTo);
    if (activeCategory) query = query.eq("category", activeCategory);
    if (areas.length > 0) query = query.in("area", areas);
    if (q) {
      const safe = q.replace(/[%,]/g, " ");
      query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    events = (data ?? []) as EventRow[];
    errorMessage = error?.message ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">検索</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          キーワード・日付・カテゴリ・エリアで絞り込めます。
        </p>
      </header>

      <div className="mb-8">
        <EventsFilters basePath="/search" />
      </div>

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
                    {event.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.cover_image_url}
                        alt=""
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-40 w-full bg-muted" />
                    )}
                    <CardContent className="flex flex-col gap-2 p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {CATEGORY_LABELS[event.category]}
                        </Badge>
                        <time className="text-xs text-muted-foreground">
                          {formatEventDateTime(event.starts_at)}
                        </time>
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
    </div>
  );
}
