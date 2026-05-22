import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SaveButton } from "./save-button";
import {
  CATEGORY_LABELS,
  formatEventDate,
  formatEventDateTime,
  type EventCategory,
} from "@/lib/events";

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

      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={event.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "lg" })}
        >
          公式サイトへ
        </a>
        <SaveButton eventId={event.id} saved={isSaved} loggedIn={!!viewer} />
      </div>
    </article>
  );
}
