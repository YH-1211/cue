import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CATEGORY_LABELS,
  EVENT_CATEGORIES,
  formatEventDateTime,
  isEventCategory,
  type EventCategory,
} from "@/lib/events";

export const metadata = { title: "イベント" };

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const activeCategory =
    categoryParam && isEventCategory(categoryParam) ? categoryParam : null;

  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select("id, title, starts_at, venue_name, area, category, cover_image_url")
    .eq("approved", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);

  if (activeCategory) {
    query = query.eq("category", activeCategory);
  }

  const { data, error } = await query;
  const events = (data ?? []) as EventRow[];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">イベント</h1>
        <p className="text-sm text-muted-foreground">
          東京で開催される、これからのイベント。
        </p>
      </header>

      {/* カテゴリフィルタ */}
      <nav
        aria-label="カテゴリで絞り込む"
        className="mb-8 -mx-1 flex flex-wrap gap-2"
      >
        <CategoryPill href="/events" active={activeCategory === null}>
          すべて
        </CategoryPill>
        {EVENT_CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat}
            href={`/events?category=${cat}`}
            active={activeCategory === cat}
          >
            {CATEGORY_LABELS[cat]}
          </CategoryPill>
        ))}
      </nav>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          イベント取得エラー: {error.message}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {activeCategory
            ? `「${CATEGORY_LABELS[activeCategory]}」の予定はまだありません。`
            : "予定されているイベントはまだありません。"}
        </div>
      ) : (
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
      )}
    </div>
  );
}

function CategoryPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-full border px-3 py-1 text-sm transition-colors " +
        (active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground")
      }
    >
      {children}
    </Link>
  );
}
