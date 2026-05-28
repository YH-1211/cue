import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SaveButton } from "./save-button";
import {
  CATEGORY_LABELS,
  formatEventDate,
  formatEventDateTime,
  type EventCategory,
} from "@/lib/events";

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
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  official_url: string;
  ticket_sale_starts_at: string | null;
  approved: boolean;
  submitted_by: string | null;
  event_tags: { tags: { slug: string; name: string } | null }[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title ?? "イベント" };
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
        venue_name, address, area, category, cover_image_url,
        official_url, ticket_sale_starts_at, approved, submitted_by,
        event_tags ( tags ( slug, name ) )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="text-sm text-red-600">
          イベント取得エラー: {error.message}
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

  const eventEndIso = event.ends_at ?? event.starts_at;
  // eslint-disable-next-line react-hooks/purity
  const isPast = new Date(eventEndIso).getTime() < Date.now();
  const canReport = event.approved && isPast;

  // 関連イベント (同カテゴリ + 同エリア優先 / 未来 / 自身を除く)
  type RelatedRow = {
    id: string;
    title: string;
    starts_at: string;
    area: string | null;
    cover_image_url: string | null;
    category: EventCategory;
  };
  let related: RelatedRow[] = [];
  if (event.approved && !isPast) {
    const nowIso = new Date().toISOString();
    let relQ = supabase
      .from("events")
      .select("id, title, starts_at, area, cover_image_url, category")
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
        .select("id, title, starts_at, area, cover_image_url, category")
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

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <Link
          href="/events"
          className="text-muted-foreground hover:text-foreground"
        >
          ← イベント一覧に戻る
        </Link>
      </nav>

      {isPending && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">承認待ちのプレビュー</p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
            このイベントはまだ公開されていません。あなただけが見られる状態です。
          </p>
        </div>
      )}

      {event.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.cover_image_url}
          alt=""
          className="mb-6 aspect-[16/9] w-full rounded-lg object-cover"
        />
      )}

      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
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
          {formatEventDateTime(event.starts_at)}
          {event.ends_at && (
            <>
              <span className="mx-1 text-muted-foreground">〜</span>
              {formatEventDateTime(event.ends_at)}
            </>
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
        <a
          href={event.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "lg" })}
        >
          公式サイトへ
        </a>
        <SaveButton eventId={event.id} saved={isSaved} loggedIn={!!viewer} />
        {!isPast && (
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
                      {r.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.cover_image_url}
                          alt=""
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-28 w-full bg-muted" />
                      )}
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
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {canReport ? (
                  <>
                    まだ感想はありません。
                    <Link
                      href={`/events/${event.id}/report`}
                      className="ml-1 text-foreground underline underline-offset-2"
                    >
                      最初のレポートを投稿
                    </Link>
                    しませんか？
                  </>
                ) : (
                  <>開催後に参加レポートが投稿されると、ここに表示されます。</>
                )}
              </div>
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
