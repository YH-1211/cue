import Link from "next/link";
import { CalendarSearch } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { NearbyEvents } from "@/components/nearby-events";
import { EventCover } from "@/components/event-cover";
import { HomeInterestEditor } from "./home-interest-editor";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  eventScheduleLabel,
  categoriesUnderParent,
  isParentCategory,
  type EventCategory,
} from "@/lib/events";
import { startOfTodayJstIso } from "@/lib/datetime";

// ヒーロー右側の「カテゴリから探す」タイル (親カテゴリ 9種)。
// クリックで /search?category=<親> に飛び、検索側で配下サブに展開される。
const CATEGORY_SHORTCUTS: { key: EventCategory; emoji: string; label: string }[] =
  [
    { key: "festival", emoji: "🏮", label: "祭り" },
    { key: "music", emoji: "🎵", label: "音楽" },
    { key: "art", emoji: "🎨", label: "アート" },
    { key: "food", emoji: "🍜", label: "フード" },
    { key: "seasonal", emoji: "🌸", label: "季節" },
    { key: "theater", emoji: "🎭", label: "舞台" },
    { key: "film", emoji: "🎬", label: "映像" },
    { key: "learning", emoji: "📚", label: "学び" },
    { key: "sports", emoji: "⚽", label: "スポーツ" },
  ];

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  has_food_stalls: boolean | null;
};

export default async function Home() {
  const supabase = await createClient();

  // ログインユーザーの興味タグを取得 (未ログインなら空)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let interestCategories: EventCategory[] = [];
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("interest_categories")
      .eq("id", user.id)
      .maybeSingle();
    interestCategories = (profile?.interest_categories ??
      []) as EventCategory[];
  }

  const hasInterests = interestCategories.length > 0;

  // 興味タグを「親→配下サブ」に展開した一致判定用セット。
  // 例: 「祭り」(festival) を選ぶと festival_shrine 等のサブも一致させる。
  const interestMatchSet = new Set<string>(
    interestCategories.flatMap((c) =>
      isParentCategory(c) ? categoriesUnderParent(c) : [c]
    )
  );

  const SELECT =
    "id, title, starts_at, ends_at, venue_name, area, category, cover_image_url, has_food_stalls";
  // 掲載カットオフ: 開催当日いっぱい表示し、翌日 0:00 JST に消す
  const nowIso = startOfTodayJstIso();

  // 興味タグがあれば、対象カテゴリのイベントをDBから直接優先取得し、
  // 残り枠を一般のイベント(開催が近い順)で補う。
  let events: EventRow[];
  if (hasInterests) {
    const [{ data: matchedData }, { data: fillData }] = await Promise.all([
      supabase
        .from("events")
        .select(SELECT)
        .eq("approved", true)
        .gte("effective_end", nowIso)
        .in("category", Array.from(interestMatchSet))
        .order("starts_at", { ascending: true })
        .limit(6),
      supabase
        .from("events")
        .select(SELECT)
        .eq("approved", true)
        .gte("effective_end", nowIso)
        .order("starts_at", { ascending: true })
        .limit(6),
    ]);

    const matched = (matchedData ?? []) as EventRow[];
    const seen = new Set(matched.map((e) => e.id));
    const fill = ((fillData ?? []) as EventRow[]).filter(
      (e) => !seen.has(e.id)
    );
    events = [...matched, ...fill].slice(0, 6);
  } else {
    const { data } = await supabase
      .from("events")
      .select(SELECT)
      .eq("approved", true)
      .gte("effective_end", nowIso)
      .order("starts_at", { ascending: true })
      .limit(6);
    events = (data ?? []) as EventRow[];
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
      {/* ヒーロー: PC では左にブランド、右にカテゴリタイルの2カラム */}
      <section className="relative my-8 overflow-hidden rounded-3xl border border-border bg-card sm:my-10">
        {/* アクセント色の放射グロー (背景装飾) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_15%_0%,color-mix(in_oklch,var(--primary)_28%,transparent),transparent_70%)]"
        />
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-12">
          {/* 左: ブランド + コピー + CTA */}
          <div className="flex flex-col items-start gap-4">
            <h1 className="bg-gradient-to-br from-foreground from-30% to-primary bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl">
              Cue
            </h1>
            <p className="max-w-md text-lg font-medium text-foreground sm:text-xl">
              東京と関東のイベント情報を、まとめてチェック。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/events"
                className={buttonVariants({ size: "default" })}
              >
                イベントを見る
              </Link>
              <Link
                href="/calendar"
                className={buttonVariants({
                  variant: "outline",
                  size: "default",
                })}
              >
                季節カレンダー
              </Link>
            </div>
          </div>

          {/* 右: カテゴリから探す (3×3 タイル) */}
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              カテゴリから探す
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_SHORTCUTS.map((c) => (
                <Link
                  key={c.key}
                  href={`/search?category=${c.key}`}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-2.5 py-2 text-sm transition-colors hover:border-primary hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-3 sm:py-2.5"
                >
                  <span aria-hidden className="text-base leading-none sm:text-lg">
                    {c.emoji}
                  </span>
                  <span className="whitespace-nowrap">{c.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 興味タグ編集 (ログイン時のみ) */}
      {user && (
        <div className="mb-12">
          <HomeInterestEditor initialCategories={interestCategories} />
        </div>
      )}

      {/* 近くで開催 (位置情報レコメンド Lv.1) */}
      <div className="mb-12">
        <NearbyEvents />
      </div>

      {/* これからのCue */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            <span
              aria-hidden
              className="h-5 w-1 shrink-0 rounded-full bg-primary"
            />
            これからのCue
          </h2>
          <Link
            href="/events"
            className="text-xs text-muted-foreground hover:text-foreground sm:text-sm"
          >
            すべて見る →
          </Link>
        </div>

        {hasInterests && (
          <p className="mb-3 text-xs text-muted-foreground">
            あなたの興味タグ (
            {interestCategories.map((c) => CATEGORY_LABELS[c]).join(" / ")})
            を優先表示中。
          </p>
        )}

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <CalendarSearch
              aria-hidden
              className="size-8 text-muted-foreground/60"
            />
            <p className="text-sm text-muted-foreground">
              予定されているイベントはまだありません。
            </p>
            <Link
              href="/events"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              すべてのイベントを見る
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                        {hasInterests &&
                          interestCategories.includes(event.category) && (
                            <Badge className="bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-105 hover:bg-primary">
                              おすすめ
                            </Badge>
                          )}
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
