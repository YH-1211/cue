import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EventCover } from "@/components/event-cover";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  eventScheduleLabel,
  type EventCategory,
} from "@/lib/events";
import { isEventExpired } from "@/lib/datetime";

export const metadata = { title: "行きたいイベント" };

type SavedEventRow = {
  events: {
    id: string;
    title: string;
    starts_at: string | null;
    venue_name: string | null;
    area: string | null;
    category: EventCategory;
    cover_image_url: string | null;
    has_food_stalls: boolean | null;
    ends_at: string | null;
    is_permanent: boolean | null;
  } | null;
};

export default async function SavedEventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/saved");
  }

  const { data } = await supabase
    .from("saved_events")
    .select(
      `
        created_at,
        events (
          id, title, starts_at, ends_at, venue_name, area, category, cover_image_url, has_food_stalls, is_permanent
        )
      `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const saved = (data ?? []) as unknown as SavedEventRow[];
  const savedEvents = saved
    .map((row) => row.events)
    .filter((e): e is NonNullable<SavedEventRow["events"]> => e !== null)
    .filter((e) => e.is_permanent || !isEventExpired(e.ends_at ?? e.starts_at));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <Link href="/me" className="text-muted-foreground hover:text-foreground">
          ← マイページに戻る
        </Link>
      </nav>

      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          行きたいイベント
        </h1>
        <span className="text-xs text-muted-foreground">
          {savedEvents.length} 件
        </span>
      </header>

      {savedEvents.length === 0 ? (
        <EmptyState
          icon={<Bookmark aria-hidden className="size-8" />}
          title="まだ「行きたい」がありません。"
        >
          <Link
            href="/events"
            className="text-foreground underline underline-offset-2"
          >
            イベント一覧
          </Link>
          から気になるものを保存できます。
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {savedEvents.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
              >
                <EventCover
                  coverImageUrl={event.cover_image_url}
                  title={event.title}
                  category={event.category}
                  hasFoodStalls={event.has_food_stalls}
                  width={200}
                  className="h-20 w-20 shrink-0"
                  rounded
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${categoryBadgeClass(event.category)}`}
                    >
                      {CATEGORY_LABELS[event.category]}
                    </Badge>
                    {event.starts_at || event.is_permanent ? (
                      (() => {
                        const s = eventScheduleLabel(
                          event.starts_at,
                          event.ends_at,
                          event.is_permanent ?? false
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
                      })()
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        日程未定
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold">
                    {event.title}
                  </p>
                  {(event.area || event.venue_name) && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {event.area && `${event.area} / `}
                      {event.venue_name}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
