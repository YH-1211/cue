import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORY_LABELS, type EventCategory } from "@/lib/events";
import { formatRelativeTime } from "@/lib/relative-time";

const PAGE_SIZE = 30;

export const metadata = { title: "ニュース" };
export const dynamic = "force-dynamic";

type NewsRow = {
  id: string;
  title: string;
  summary: string | null;
  source_name: string;
  source_url: string;
  category: EventCategory;
  image_url: string | null;
  published_at: string;
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { before } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("news_items")
    .select(
      "id, title, summary, source_name, source_url, category, image_url, published_at"
    )
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (before) {
    query = query.lt("published_at", before);
  }

  const { data, error } = await query;
  const news = (data ?? []) as NewsRow[];

  const nextBefore =
    news.length === PAGE_SIZE ? news[news.length - 1].published_at : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">ニュース</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          アート・音楽・カルチャー系の最新ニュース。
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          読み込みに失敗しました: {error.message}
        </div>
      )}

      {news.length === 0 && !before && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          まだニュースがありません。
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {news.map((n) => (
          <li
            key={n.id}
            className="rounded-xl border border-border bg-card transition-colors hover:bg-muted"
          >
            <Link
              href={n.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-3"
            >
              {n.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={n.image_url}
                  alt=""
                  loading="lazy"
                  className="h-20 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  no image
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[n.category]}
                  </Badge>
                  <span className="truncate text-xs text-muted-foreground">
                    {n.source_name}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm font-semibold">{n.title}</p>
                {n.summary && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {n.summary}
                  </p>
                )}
                <time className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(n.published_at)}
                </time>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {nextBefore && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`/news?before=${encodeURIComponent(nextBefore)}`}
            className={buttonVariants({ variant: "outline" })}
          >
            もっと見る
          </Link>
        </div>
      )}
    </div>
  );
}
