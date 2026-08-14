import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EventCover } from "@/components/event-cover";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  eventScheduleLabel,
  type EventCategory,
} from "@/lib/events";

export const metadata = { title: "投稿したイベント" };

type SubmittedEventRow = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  has_food_stalls: boolean | null;
  ends_at: string | null;
  is_permanent: boolean | null;
  approved: boolean;
  created_at: string;
};

export default async function SubmittedEventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/submitted");
  }

  const { data } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, venue_name, area, category, cover_image_url, has_food_stalls, is_permanent, approved, created_at"
    )
    .eq("submitted_by", user.id)
    .eq("source_type", "user")
    .order("created_at", { ascending: false });

  const submittedEvents = (data ?? []) as SubmittedEventRow[];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <Link href="/me" className="text-muted-foreground hover:text-foreground">
          ← マイページに戻る
        </Link>
      </nav>

      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          投稿したイベント
        </h1>
        <Link
          href="/events/new"
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          + 新規投稿
        </Link>
      </header>

      {submittedEvents.length === 0 ? (
        <EmptyState
          icon={<PlusCircle aria-hidden className="size-8" />}
          title="まだ投稿はありません。"
        >
          <Link
            href="/events/new"
            className="text-foreground underline underline-offset-2"
          >
            イベントを投稿
          </Link>
          してみましょう。
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {submittedEvents.map((event) => (
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
                    <Badge
                      variant={event.approved ? "default" : "outline"}
                      className="text-xs"
                    >
                      {event.approved ? "公開中" : "承認待ち"}
                    </Badge>
                    {(() => {
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
                    })()}
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
