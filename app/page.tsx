import type { Metadata } from "next";
import Link from "next/link";
import { CalendarSearch } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { NearbyEvents } from "@/components/nearby-events";
import { EventCover } from "@/components/event-cover";
import { EmptyState } from "@/components/ui/empty-state";
import { HomeInterestEditor } from "./home-interest-editor";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  eventScheduleLabel,
  categoriesUnderParent,
  isParentCategory,
  type EventCategory,
} from "@/lib/events";
import { startOfTodayJstIso, jstParts, jstDateToUtc } from "@/lib/datetime";

// トップページ固有のメタデータ。タイトル/OGP はレイアウトの既定値を使い、
// ここでは正規URL (canonical) を明示して重複URL評価を防ぐ。
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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
  is_permanent: boolean | null;
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
    "id, title, starts_at, ends_at, venue_name, area, category, cover_image_url, has_food_stalls, is_permanent";
  // 掲載カットオフ: 開催当日いっぱい表示し、翌日 0:00 JST に消す
  const nowIso = startOfTodayJstIso();

  // 掲載中(開催前〜当日)イベントの総数。ヒーローに表示する。
  const { count: totalCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("approved", true)
    .gte("effective_end", nowIso);

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

  // 今週末 (JST の次の土曜 0:00 〜 月曜 0:00) に開催されるイベント。
  // 検索の「今週末」フィルタと同じ範囲計算にして体験を揃える。
  const jst = jstParts(new Date());
  const daysUntilSat = (6 - jst.dow + 7) % 7;
  const weekendFrom = jstDateToUtc(
    jst.year,
    jst.month,
    jst.day + daysUntilSat,
    0
  ).toISOString();
  const weekendTo = jstDateToUtc(
    jst.year,
    jst.month,
    jst.day + daysUntilSat + 2,
    0
  ).toISOString();
  const { data: weekendData } = await supabase
    .from("events")
    .select(SELECT)
    .eq("approved", true)
    .gte("starts_at", weekendFrom)
    .lt("starts_at", weekendTo)
    .order("starts_at", { ascending: true })
    .limit(10);
  const weekendEvents = (weekendData ?? []) as EventRow[];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-16 sm:px-6">
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
            {typeof totalCount === "number" && (
              <p className="text-sm text-muted-foreground">
                現在{" "}
                <span className="font-semibold text-foreground">
                  {totalCount.toLocaleString()}
                </span>{" "}
                件のイベントを掲載中
              </p>
            )}
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

      {/* 今週末に開催 (日付軸の導線) */}
      {weekendEvents.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
              <span
                aria-hidden
                className="h-5 w-1 shrink-0 rounded-full bg-primary"
              />
              今週末に開催
            </h2>
            <Link
              href="/search?date=weekend"
              className="text-xs text-muted-foreground hover:text-foreground sm:text-sm"
            >
              すべて見る →
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {weekendEvents.map((event) => (
              <HomeEventCard key={event.id} event={event} />
            ))}
          </ul>
        </section>
      )}

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
          <EmptyState
            icon={<CalendarSearch aria-hidden className="size-8" />}
            title="予定されているイベントはまだありません。"
          >
            <Link
              href="/events"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              すべてのイベントを見る
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {events.map((event) => (
              <HomeEventCard
                key={event.id}
                event={event}
                recommended={
                  hasInterests && interestCategories.includes(event.category)
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ホームのイベントカード。おすすめバッジは興味タグ一致時のみ表示。
function HomeEventCard({
  event,
  recommended = false,
}: {
  event: EventRow;
  recommended?: boolean;
}) {
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
              {recommended && (
                <Badge className="bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-105 hover:bg-primary">
                  おすすめ
                </Badge>
              )}
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
