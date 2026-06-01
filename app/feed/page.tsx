import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  PARENT_CATEGORIES,
  PARENT_LABELS,
  categoriesUnderParent,
  isEventCategory,
  isParentCategory,
  parentOf,
  type EventCategory,
} from "@/lib/events";
import { formatRelativeTime } from "@/lib/relative-time";
import { LikeButton } from "./like-button";
import { CommentSection } from "./comment-section";
import { ShareCardButton } from "./share-card-button";

const PAGE_SIZE = 20;

export const metadata = { title: "フィード" };

type Photo = { id: string; storage_path: string; caption: string | null };

type FeedRow = {
  id: string;
  memo: string | null;
  rating: number | null;
  attended_on: string;
  created_at: string;
  user_id: string;
  like_count: number;
  comment_count: number;
  events: {
    id: string;
    title: string;
    category: EventCategory;
    venue_name: string | null;
    area: string | null;
  } | null;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  attended_photos: Photo[];
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; tab?: string; category?: string }>;
}) {
  const { before, tab, category: categoryParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const following = tab === "following";
  const activeCategory =
    categoryParam && isEventCategory(categoryParam) ? categoryParam : null;
  const activeParent = activeCategory ? parentOf(activeCategory) : null;

  // フォロー中タブ: 表示者がフォローしているユーザーの ID 一覧
  let followeeIds: string[] | null = null;
  if (following) {
    if (!viewer) {
      followeeIds = [];
    } else {
      const { data: rows } = await supabase
        .from("follows")
        .select("followee_id")
        .eq("follower_id", viewer.id);
      followeeIds = (rows ?? []).map((r) => r.followee_id);
    }
  }

  let query = supabase
    .from("attended_events")
    .select(
      `
        id, memo, rating, attended_on, created_at, user_id, like_count, comment_count,
        events!inner ( id, title, category, venue_name, area, approved ),
        profiles!attended_events_user_id_fkey ( id, display_name, avatar_url ),
        attended_photos ( id, storage_path, caption )
      `
    )
    .eq("events.approved", true)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (following) {
    // フォロー対象が居なければ空 (不可能な UUID で 0 件に)
    query = query.in(
      "user_id",
      followeeIds && followeeIds.length > 0
        ? followeeIds
        : ["00000000-0000-0000-0000-000000000000"]
    );
  }

  if (activeCategory) {
    query = isParentCategory(activeCategory)
      ? query.in("events.category", categoriesUnderParent(activeCategory))
      : query.eq("events.category", activeCategory);
  }

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  const reports = (data ?? []) as unknown as FeedRow[];

  // ページネーション用に現在のフィルタを保持する querystring を作る
  function feedHref(next: { tab?: string; category?: string; before?: string }) {
    const sp = new URLSearchParams();
    const t = next.tab ?? (following ? "following" : "");
    const c = next.category ?? activeCategory ?? "";
    if (t) sp.set("tab", t);
    if (c) sp.set("category", c);
    if (next.before) sp.set("before", next.before);
    const qs = sp.toString();
    return qs ? `/feed?${qs}` : "/feed";
  }

  // 表示者の「いいね済み」マップ
  let likedSet = new Set<string>();
  if (viewer && reports.length > 0) {
    const { data: likes } = await supabase
      .from("attended_likes")
      .select("attended_event_id")
      .eq("user_id", viewer.id)
      .in(
        "attended_event_id",
        reports.map((r) => r.id)
      );
    likedSet = new Set((likes ?? []).map((l) => l.attended_event_id));
  }

  // 写真の public URL
  const photoUrl = (p: string) =>
    supabase.storage.from("event-reports").getPublicUrl(p).data.publicUrl;

  const nextBefore =
    reports.length === PAGE_SIZE ? reports[reports.length - 1].created_at : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">フィード</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          みんなの「行ってきた」レポート。
        </p>
      </header>

      {/* タブ: すべて / フォロー中 */}
      <div className="mb-4 flex gap-1 border-b border-border">
        <Link
          href={feedHref({ tab: "", before: undefined })}
          className={
            "px-4 py-2 text-sm font-medium transition-colors " +
            (!following
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          すべて
        </Link>
        <Link
          href={feedHref({ tab: "following", before: undefined })}
          className={
            "px-4 py-2 text-sm font-medium transition-colors " +
            (following
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          フォロー中
        </Link>
      </div>

      {/* カテゴリ (親単位) */}
      <nav
        aria-label="カテゴリで絞り込む"
        className="mb-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex gap-1.5">
          <FeedPill
            href={feedHref({ category: "", before: undefined })}
            active={activeCategory === null}
          >
            すべて
          </FeedPill>
          {PARENT_CATEGORIES.map((p) => (
            <FeedPill
              key={p}
              href={feedHref({ category: p, before: undefined })}
              active={activeParent === p}
            >
              {PARENT_LABELS[p]}
            </FeedPill>
          ))}
        </div>
      </nav>

      {following && !viewer && (
        <div className="mb-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          フォロー中のフィードを見るには
          <Link
            href="/login"
            className="mx-1 text-foreground underline underline-offset-2"
          >
            ログイン
          </Link>
          してください。
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          読み込みに失敗しました: {error.message}
        </div>
      )}

      {reports.length === 0 && !before && !(following && !viewer) && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {following ? (
            <>
              フォロー中のユーザーの投稿はまだありません。
              <br />
              気になる人をフォローすると、ここに表示されます。
            </>
          ) : activeCategory ? (
            <>
              「{CATEGORY_LABELS[activeCategory]}」のレポートはまだありません。
            </>
          ) : (
            <>
              まだレポートがありません。
              <br />
              イベントに行ったら、詳細ページから「行ってきた」を投稿できます。
            </>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {reports.map((r) => {
          const ev = r.events;
          const photos = r.attended_photos ?? [];
          const author = r.profiles;
          const name = author?.display_name ?? "ゲスト";
          const initial = name.charAt(0).toUpperCase();
          const liked = likedSet.has(r.id);

          return (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              {/* ヘッダ: 投稿者 + 時刻 */}
              <div className="flex items-center gap-3">
                {author ? (
                  <Link
                    href={`/users/${author.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
                  >
                    <Avatar className="size-9">
                      {author.avatar_url && (
                        <AvatarImage src={author.avatar_url} alt="" />
                      )}
                      <AvatarFallback>{initial}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">
                        {name}
                      </span>
                      <time className="text-xs text-muted-foreground">
                        {formatRelativeTime(r.created_at)}
                      </time>
                    </div>
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback>{initial}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">
                        {name}
                      </span>
                      <time className="text-xs text-muted-foreground">
                        {formatRelativeTime(r.created_at)}
                      </time>
                    </div>
                  </div>
                )}
              </div>

              {/* イベントへのリンク */}
              {ev && (
                <Link
                  href={`/events/${ev.id}`}
                  className="mt-3 block rounded-lg border border-border bg-background/50 p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {CATEGORY_LABELS[ev.category]}
                    </Badge>
                    {(ev.area || ev.venue_name) && (
                      <span className="truncate text-xs text-muted-foreground">
                        {ev.area && `${ev.area} / `}
                        {ev.venue_name}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold">
                    {ev.title}
                  </p>
                </Link>
              )}

              {/* 写真 */}
              {photos.length > 0 && (
                <div
                  className={
                    "mt-3 grid gap-1 overflow-hidden rounded-lg " +
                    (photos.length === 1
                      ? "grid-cols-1"
                      : photos.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3")
                  }
                >
                  {photos.slice(0, 6).map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={photoUrl(p.storage_path)}
                      alt={p.caption ?? ""}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  ))}
                </div>
              )}

              {/* 本文 */}
              {(r.memo || r.rating) && (
                <div className="mt-3 flex flex-col gap-2">
                  {r.rating != null && (
                    <span className="text-sm text-amber-500">
                      {"★".repeat(r.rating)}
                      <span className="text-muted-foreground">
                        {"★".repeat(5 - r.rating)}
                      </span>
                    </span>
                  )}
                  {r.memo && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {r.memo}
                    </p>
                  )}
                </div>
              )}

              {/* アクション */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <LikeButton
                  attendedEventId={r.id}
                  initialLiked={liked}
                  initialCount={r.like_count}
                  disabled={!viewer}
                />
                <div className="flex items-center gap-3">
                  {ev && (
                    <ShareCardButton
                      attendedEventId={r.id}
                      eventTitle={ev.title}
                    />
                  )}
                  {ev && (
                    <Link
                      href={`/events/${ev.id}`}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      イベントを見る →
                    </Link>
                  )}
                </div>
              </div>

              {/* コメント */}
              <div className="mt-3">
                <CommentSection
                  attendedEventId={r.id}
                  initialCount={r.comment_count}
                  viewerId={viewer?.id ?? null}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {nextBefore && (
        <div className="mt-6 flex justify-center">
          <Link
            href={feedHref({ before: nextBefore })}
            className={buttonVariants({ variant: "outline" })}
          >
            もっと見る
          </Link>
        </div>
      )}

      {!viewer && reports.length > 0 && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          いいねや投稿には
          <Link
            href="/login"
            className="ml-1 text-foreground underline underline-offset-2"
          >
            ログイン
          </Link>
          が必要です。
        </p>
      )}
    </div>
  );
}

function FeedPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground")
      }
    >
      {children}
    </Link>
  );
}
