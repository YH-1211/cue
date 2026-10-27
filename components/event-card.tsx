import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EventCover } from "@/components/event-cover";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  eventScheduleLabel,
  type EventCategory,
} from "@/lib/events";

// 一覧系ページ (エリア別 / カテゴリ別 / 月別) で共通に使うカード。
export type EventListItem = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  has_food_stalls: boolean | null;
  is_permanent: boolean | null;
};

export function EventCard({ event }: { event: EventListItem }) {
  const schedule =
    event.starts_at || event.is_permanent
      ? eventScheduleLabel(
          event.starts_at,
          event.ends_at,
          event.is_permanent ?? false,
        )
      : null;

  return (
    <li>
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
              {schedule ? (
                <time
                  className={`text-xs ${
                    schedule.ongoing
                      ? "font-medium text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {schedule.text}
                </time>
              ) : (
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  日程未定
                </span>
              )}
            </div>
            <h3 className="line-clamp-2 text-base font-semibold leading-snug">
              {event.title}
            </h3>
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
  );
}

export function EventGrid({ events }: { events: EventListItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </ul>
  );
}
