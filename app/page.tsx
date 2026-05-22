import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  formatEventDateTime,
  type EventCategory,
} from "@/lib/events";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
};

export default async function Home() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select("id, title, starts_at, venue_name, area, category, cover_image_url")
    .eq("approved", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(6);

  const events = (data ?? []) as EventRow[];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
      {/* ヒーロー */}
      <section className="flex flex-col items-start gap-3 py-12 sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          行きたいが、
          <br className="sm:hidden" />
          見つかる。
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          アート、音楽、舞台、祭り、季節の出来事。
          <br className="sm:hidden" />
          気になる予定をまとめてチェック。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/events" className={buttonVariants({ size: "default" })}>
            イベントを見る
          </Link>
          <Link
            href="/calendar"
            className={buttonVariants({ variant: "outline", size: "default" })}
          >
            季節カレンダー
          </Link>
        </div>
      </section>

      {/* これからのCue */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            これからのCue
          </h2>
          <Link
            href="/events"
            className="text-xs text-muted-foreground hover:text-foreground sm:text-sm"
          >
            すべて見る →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            予定されているイベントはまだありません。
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
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
