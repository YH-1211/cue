import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EventCover } from "@/components/event-cover";
import { Separator } from "@/components/ui/separator";
import { SaveButton } from "./save-button";
import { TrackView, TrackedLink } from "./track";
import { AdminDeleteButton } from "./admin-delete-button";
import { BackButton } from "@/components/back-button";
import { isAdmin } from "@/lib/admin";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  formatEventDate,
  formatEventDateTime,
  type EventCategory,
} from "@/lib/events";
import { startOfTodayJstIso, isEventExpired } from "@/lib/datetime";
import { SITE } from "@/lib/site";

type ReportPhoto = {
  id: string;
  storage_path: string;
  caption: string | null;
};

type ReportRow = {
  id: string;
  memo: string | null;
  rating: number | null;
  attended_on: string;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  attended_photos: ReportPhoto[];
};

function formatReportDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
}

function ratingStars(rating: number | null) {
  if (!rating) return null;
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  has_food_stalls: boolean | null;
  official_url: string;
  ticket_url: string | null;
  ticket_sale_starts_at: string | null;
  ticket_sale_ends_at: string | null;
  is_free: boolean | null;
  lat: number | null;
  lng: number | null;
  approved: boolean;
  submitted_by: string | null;
  event_tags: { tags: { slug: string; name: string } | null }[];
};

// 検索エンジン向けの構造化データ (schema.org/Event)。
// これを埋めると Google 検索でイベントのリッチリザルト(日付・場所つきカード)が
// 出て、検索結果から直接この詳細ページに来られるようになる。
// 承認済み & 開催日ありのイベントのみ出す (未承認・日程未定はリッチ対象外)。
function buildEventJsonLd(e: EventDetail): Record<string, unknown> | null {
  if (!e.approved || !e.starts_at) return null;

  const url = `${SITE.url}/events/${e.id}`;
  const image = e.cover_image_url || `${SITE.url}/api/og/event/${e.id}`;

  const place: Record<string, unknown> = {
    "@type": "Place",
    name: e.venue_name || e.area || "会場未定",
  };
  const addr = e.address || e.area;
  if (addr) {
    place.address = {
      "@type": "PostalAddress",
      streetAddress: addr,
      addressCountry: "JP",
    };
  }
  if (e.lat != null && e.lng != null) {
    place.geo = {
      "@type": "GeoCoordinates",
      latitude: e.lat,
      longitude: e.lng,
    };
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: new Date(e.starts_at).toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: place,
    image: [image],
    url,
  };
  if (e.ends_at) jsonLd.endDate = new Date(e.ends_at).toISOString();
  if (e.description) jsonLd.description = e.description.trim().slice(0, 500);

  if (e.is_free) {
    jsonLd.offers = {
      "@type": "Offer",
      price: 0,
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
      url: e.ticket_url || e.official_url,
    };
  } else if (e.ticket_url) {
    jsonLd.offers = {
      "@type": "Offer",
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
      url: e.ticket_url,
    };
  }

  return jsonLd;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(
      "title, description, area, venue_name, starts_at, cover_image_url, approved"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return { title: "イベント" };

  const title = data.title ?? "イベント";
  const where = [data.area, data.venue_name].filter(Boolean).join(" / ");
  const dateLabel = data.starts_at ? formatEventDate(data.starts_at) : null;
  // 説明文: イベント説明 → 無ければ「日時・場所 | キャッチコピー」で補完
  const description =
    (data.description?.trim().slice(0, 110) ||
      [dateLabel, where].filter(Boolean).join(" / ")) +
    (data.description ? "" : ` | ${SITE.name}でチェック`);

  // 公開イベントのみ OGP 画像を出す (未承認はクロール対象外)
  const ogImage =
    data.approved
      ? data.cover_image_url || `/api/og/event/${id}`
      : "/api/og";

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/events/${id}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(
      `
        id, title, description, starts_at, ends_at,
        venue_name, address, area, category, cover_image_url, has_food_stalls,
        official_url, ticket_url, ticket_sale_starts_at, ticket_sale_ends_at,
        is_free, lat, lng, approved, submitted_by,
        event_tags ( tags ( slug, name ) )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[event detail] query failed:", error);
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="text-sm text-red-600">
          イベントの取得に失敗しました。時間をおいて再度お試しください。
        </p>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  const event = data as unknown as EventDetail;

  // 未承認イベントは投稿者本人のみ閲覧可
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  if (!event.approved && event.submitted_by !== viewer?.id) {
    notFound();
  }
  const tags = (event.event_tags ?? [])
    .map((et) => et.tags)
    .filter((t): t is { slug: string; name: string } => t !== null);

  // 「行きたい」登録済みか
  let isSaved = false;
  if (viewer) {
    const { data: saved } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("user_id", viewer.id)
      .eq("event_id", event.id)
      .maybeSingle();
    isSaved = !!saved;
  }

  const isPending = !event.approved;
  const admin = await isAdmin();

  // 行ったレポート一覧 (公開済みイベントのみ表示)
  let reports: ReportRow[] = [];
  let viewerHasReport = false;
  if (event.approved) {
    const { data: reportsData } = await supabase
      .from("attended_events")
      .select(
        `
          id, memo, rating, attended_on, created_at, user_id,
          profiles ( id, display_name, avatar_url ),
          attended_photos ( id, storage_path, caption )
        `
      )
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .limit(30);

    reports = (reportsData ?? []) as unknown as ReportRow[];
    if (viewer) {
      viewerHasReport = reports.some((r) => r.user_id === viewer.id);
    }
  }

  // Storage public URL を一括解決
  const photoUrlMap = new Map<string, string>();
  for (const r of reports) {
    for (const p of r.attended_photos ?? []) {
      const { data: pub } = supabase.storage
        .from("event-reports")
        .getPublicUrl(p.storage_path);
      photoUrlMap.set(p.id, pub.publicUrl);
    }
  }

  const hasDate = event.starts_at != null;
  const eventEndIso = event.ends_at ?? event.starts_at;
  // Server Component なので描画時の現在時刻取得で問題ない。
  const now = new Date();
  const nowMs = now.getTime();
  const isPast =
    eventEndIso != null && new Date(eventEndIso).getTime() < nowMs;
  // 掲載期限切れ: 開催日の翌日 0:00 JST を過ぎた状態。
  // 開催当日いっぱいはアクティブ表示し、翌日からグレーアウト+リンク無効化。
  const isExpired = isEventExpired(eventEndIso, now);
  const canReport = event.approved && isPast;

  // チケット販売終了の判定
  const ticketSaleEnded =
    event.ticket_sale_ends_at != null &&
    new Date(event.ticket_sale_ends_at).getTime() < nowMs;

  // 関連イベント (同カテゴリ + 同エリア優先 / 未来 / 自身を除く)
  type RelatedRow = {
    id: string;
    title: string;
    starts_at: string;
    area: string | null;
    cover_image_url: string | null;
    category: EventCategory;
    has_food_stalls: boolean | null;
  };
  let related: RelatedRow[] = [];
  if (event.approved && !isPast) {
    const nowIso = startOfTodayJstIso(now);
    let relQ = supabase
      .from("events")
      .select("id, title, starts_at, area, cover_image_url, category, has_food_stalls")
      .eq("approved", true)
      .neq("id", event.id)
      .eq("category", event.category)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(6);
    if (event.area) {
      // エリアが分かるときは同エリア優先
      relQ = relQ.eq("area", event.area);
    }
    const { data: relData } = await relQ;
    related = (relData ?? []) as RelatedRow[];

    // 同エリアで足りなければ、同カテゴリの他エリアでも補完
    if (event.area && related.length < 6) {
      const need = 6 - related.length;
      const { data: more } = await supabase
        .from("events")
        .select("id, title, starts_at, area, cover_image_url, category, has_food_stalls")
        .eq("approved", true)
        .neq("id", event.id)
        .eq("category", event.category)
        .neq("area", event.area)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(need);
      related = [...related, ...((more ?? []) as RelatedRow[])];
    }
  }

  const jsonLd = buildEventJsonLd(event);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {event.approved && <TrackView eventId={event.id} />}
      <nav className="mb-4 text-sm">
        <BackButton fallbackHref="/events" label="戻る" />
      </nav>

      {isPending && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">承認待ちのプレビュー</p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
            このイベントはまだ公開されていません。あなただけが見られる状態です。
          </p>
        </div>
      )}

      {isExpired && (
        <div className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">
            このイベントは終了しました
          </p>
          <p className="mt-1">
            開催日を過ぎたため、公式サイトやチケットへのリンクは無効になっています。
          </p>
        </div>
      )}

      <EventCover
        coverImageUrl={event.cover_image_url}
        title={event.title}
        category={event.category}
        hasFoodStalls={event.has_food_stalls}
        width={1600}
        className={`mb-6 aspect-[16/9] w-full rounded-lg${
          isExpired ? " opacity-50 grayscale" : ""
        }`}
      />

      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={categoryBadgeClass(event.category)}
          >
            {CATEGORY_LABELS[event.category]}
          </Badge>
          {tags.map((tag) => (
            <Badge key={tag.slug} variant="outline">
              {tag.name}
            </Badge>
          ))}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {event.title}
        </h1>
      </header>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-5 text-sm sm:grid-cols-[120px_1fr]">
        <dt className="font-medium text-muted-foreground">開催日時</dt>
        <dd>
          {event.starts_at ? (
            <>
              {formatEventDateTime(event.starts_at)}
              {event.ends_at && (
                <>
                  <span className="mx-1 text-muted-foreground">〜</span>
                  {formatEventDateTime(event.ends_at)}
                </>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                日程未定
              </span>
              <span className="text-muted-foreground">
                日時が決まり次第お知らせします
              </span>
            </span>
          )}
        </dd>

        {(event.venue_name || event.address) && (
          <>
            <dt className="font-medium text-muted-foreground">会場</dt>
            <dd>
              {event.venue_name && <div>{event.venue_name}</div>}
              {event.address && (
                <div className="text-muted-foreground">{event.address}</div>
              )}
            </dd>
          </>
        )}

        {event.ticket_sale_starts_at && (
          <>
            <dt className="font-medium text-muted-foreground">
              チケット発売
            </dt>
            <dd>{formatEventDate(event.ticket_sale_starts_at)} 〜</dd>
          </>
        )}

        {event.ticket_sale_ends_at && (
          <>
            <dt className="font-medium text-muted-foreground">
              チケット販売
            </dt>
            <dd>
              {ticketSaleEnded ? (
                <span className="inline-flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    販売終了
                  </span>
                  <span className="text-muted-foreground">
                    {formatEventDateTime(event.ticket_sale_ends_at)} まで
                  </span>
                </span>
              ) : (
                <>〜 {formatEventDateTime(event.ticket_sale_ends_at)} まで</>
              )}
            </dd>
          </>
        )}
      </dl>

      {event.description && (
        <>
          <Separator className="my-8" />
          <section>
            <h2 className="mb-3 text-lg font-semibold">概要</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {event.description}
            </p>
          </section>
        </>
      )}

      <Separator className="my-8" />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {isExpired ? (
          <span
            className={buttonVariants({ size: "lg" })}
            aria-disabled="true"
            style={{ opacity: 0.5, pointerEvents: "none" }}
          >
            公式サイト (終了)
          </span>
        ) : (
          <TrackedLink
            eventId={event.id}
            kind="official_click"
            href={event.official_url}
            className={buttonVariants({ size: "lg" })}
          >
            公式サイトへ
          </TrackedLink>
        )}
        {event.ticket_url &&
          (ticketSaleEnded || isExpired ? (
            <span
              className={buttonVariants({ size: "lg", variant: "outline" })}
              aria-disabled="true"
              style={{ opacity: 0.5, pointerEvents: "none" }}
            >
              チケット販売終了
            </span>
          ) : (
            <TrackedLink
              eventId={event.id}
              kind="ticket_click"
              href={event.ticket_url}
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              チケットを購入
            </TrackedLink>
          ))}
        {!isExpired && (
          <SaveButton eventId={event.id} saved={isSaved} loggedIn={!!viewer} />
        )}
        {!isPast && hasDate && (
          <a
            href={`/api/events/${event.id}/ics`}
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            カレンダーに追加 (.ics)
          </a>
        )}
        {canReport && (
          <Link
            href={`/events/${event.id}/report`}
            className={buttonVariants({
              size: "lg",
              variant: viewerHasReport ? "outline" : "default",
            })}
          >
            {viewerHasReport ? "レポートを編集" : "行ってきた / 感想を投稿"}
          </Link>
        )}
        {admin && <AdminDeleteButton eventId={event.id} title={event.title} />}
      </div>

      {related.length > 0 && (
        <>
          <Separator className="my-10" />
          <section>
            <h2 className="mb-4 text-lg font-semibold">
              関連イベント
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                同じ「{CATEGORY_LABELS[event.category]}」
                {event.area && ` × ${event.area}優先`}
              </span>
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={`/events/${r.id}`} className="group block">
                    <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
                      <EventCover
                        coverImageUrl={r.cover_image_url}
                        title={r.title}
                        category={r.category}
                        hasFoodStalls={r.has_food_stalls}
                        width={500}
                        className="h-28 w-full"
                      />
                      <CardContent className="flex flex-col gap-1 p-3">
                        <time className="text-xs text-muted-foreground">
                          {formatEventDateTime(r.starts_at)}
                        </time>
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          {r.title}
                        </p>
                        {r.area && (
                          <span className="text-xs text-muted-foreground">
                            {r.area}
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {event.approved && (
        <>
          <Separator className="my-10" />
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">みんなの感想</h2>
              <span className="text-xs text-muted-foreground">
                {reports.length} 件
              </span>
            </div>

            {reports.length === 0 ? (
              <EmptyState
                title={
                  canReport
                    ? "まだ感想はありません。"
                    : "開催後に参加レポートが投稿されると、ここに表示されます。"
                }
              >
                {canReport ? (
                  <Link
                    href={`/events/${event.id}/report`}
                    className="text-foreground underline underline-offset-2"
                  >
                    最初のレポートを投稿しませんか？
                  </Link>
                ) : null}
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-4">
                {reports.map((r) => {
                  const name =
                    r.profiles?.display_name ?? "匿名ユーザー";
                  const initial = name.charAt(0).toUpperCase();
                  const photos = r.attended_photos ?? [];
                  return (
                    <li
                      key={r.id}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          {r.profiles?.avatar_url && (
                            <AvatarImage src={r.profiles.avatar_url} alt="" />
                          )}
                          <AvatarFallback>{initial}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-semibold">
                            {name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            参加日 {formatReportDate(r.attended_on)}
                          </span>
                        </div>
                        {r.rating != null && (
                          <span
                            className="text-sm text-amber-500"
                            aria-label={`評価 ${r.rating} / 5`}
                          >
                            {ratingStars(r.rating)}
                          </span>
                        )}
                      </div>

                      {photos.length > 0 && (
                        <ul
                          className={
                            "mt-3 grid gap-2 " +
                            (photos.length === 1
                              ? "grid-cols-1"
                              : photos.length === 2
                              ? "grid-cols-2"
                              : "grid-cols-3")
                          }
                        >
                          {photos.map((p) => (
                            <li
                              key={p.id}
                              className="aspect-square overflow-hidden rounded border border-border bg-muted"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrlMap.get(p.id) ?? ""}
                                alt={p.caption ?? ""}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </li>
                          ))}
                        </ul>
                      )}

                      {r.memo && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                          {r.memo}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </article>
  );
}
