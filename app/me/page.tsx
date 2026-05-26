import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/login/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CATEGORY_LABELS,
  formatEventDateTime,
  type EventCategory,
} from "@/lib/events";

type ReportListRow = {
  id: string;
  attended_on: string;
  rating: number | null;
  memo: string | null;
  created_at: string;
  events: {
    id: string;
    title: string;
    starts_at: string;
    category: EventCategory;
  } | null;
  attended_photos: { id: string; storage_path: string }[];
};

function formatAttendedDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export const metadata = { title: "マイページ" };

type SavedEventRow = {
  created_at: string;
  events: {
    id: string;
    title: string;
    starts_at: string;
    venue_name: string | null;
    area: string | null;
    category: EventCategory;
    cover_image_url: string | null;
  } | null;
};

type SubmittedEventRow = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  approved: boolean;
  created_at: string;
};

type PointTransactionRow = {
  id: string;
  delta: number;
  reason: string;
  ref_event_id: string | null;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  event_approved: "イベント承認ボーナス",
};

function formatPointDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileRes, savedRes, submittedRes, pointHistoryRes, reportsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, points, interest_categories")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("saved_events")
      .select(
        `
          created_at,
          events (
            id, title, starts_at, venue_name, area, category, cover_image_url
          )
        `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select(
        "id, title, starts_at, venue_name, area, category, cover_image_url, approved, created_at"
      )
      .eq("submitted_by", user.id)
      .eq("source_type", "user")
      .order("created_at", { ascending: false }),
    supabase
      .from("point_transactions")
      .select("id, delta, reason, ref_event_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("attended_events")
      .select(
        `
          id, attended_on, rating, memo, created_at,
          events ( id, title, starts_at, category ),
          attended_photos ( id, storage_path )
        `
      )
      .eq("user_id", user.id)
      .order("attended_on", { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.data;
  const points = profile?.points ?? 0;
  const interestCategories = (profile?.interest_categories ?? []) as EventCategory[];
  const pointHistory = (pointHistoryRes.data ?? []) as PointTransactionRow[];
  const saved = (savedRes.data ?? []) as unknown as SavedEventRow[];
  const savedEvents = saved
    .map((row) => row.events)
    .filter(
      (e): e is NonNullable<SavedEventRow["events"]> => e !== null
    );

  const submittedEvents = (submittedRes.data ?? []) as SubmittedEventRow[];

  const reports = (reportsRes.data ?? []) as unknown as ReportListRow[];
  const reportPhotoUrl = (path: string) =>
    supabase.storage.from("event-reports").getPublicUrl(path).data.publicUrl;

  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "ゲスト";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile?.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt="" />
          )}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end rounded-lg border border-border bg-card px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            pt
          </span>
          <span className="text-xl font-bold tabular-nums">{points}</span>
        </div>
      </header>

      <Separator className="my-8" />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">行きたいイベント</h2>
          <span className="text-xs text-muted-foreground">
            {savedEvents.length} 件
          </span>
        </div>

        {savedEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            まだ登録されていません。
            <Link
              href="/events"
              className="ml-1 text-foreground underline underline-offset-2"
            >
              イベント一覧
            </Link>
            から気になるものを保存できます。
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {savedEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
                >
                  {event.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.cover_image_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded bg-muted" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[event.category]}
                      </Badge>
                      <time className="text-xs text-muted-foreground">
                        {formatEventDateTime(event.starts_at)}
                      </time>
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
      </section>

      <Separator className="my-8" />

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">投稿したイベント</h2>
          <Link
            href="/events/new"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            + 新規投稿
          </Link>
        </div>

        {submittedEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            まだ投稿はありません。
            <Link
              href="/events/new"
              className="ml-1 text-foreground underline underline-offset-2"
            >
              イベントを投稿
            </Link>
            してみましょう。
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {submittedEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
                >
                  {event.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.cover_image_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded bg-muted" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[event.category]}
                      </Badge>
                      <Badge
                        variant={event.approved ? "default" : "outline"}
                        className="text-xs"
                      >
                        {event.approved ? "公開中" : "承認待ち"}
                      </Badge>
                      <time className="text-xs text-muted-foreground">
                        {formatEventDateTime(event.starts_at)}
                      </time>
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
      </section>

      <Separator className="my-8" />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">ポイント履歴</h2>
          <span className="text-xs text-muted-foreground">
            残高 {points} pt
          </span>
        </div>

        {pointHistory.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            まだ履歴がありません。
            <br />
            投稿が承認されると +10pt が加算されます。
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pointHistory.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {REASON_LABELS[tx.reason] ?? tx.reason}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPointDate(tx.created_at)}
                  </span>
                </div>
                <span
                  className={
                    "tabular-nums font-semibold " +
                    (tx.delta >= 0 ? "text-emerald-600" : "text-red-600")
                  }
                >
                  {tx.delta > 0 ? "+" : ""}
                  {tx.delta} pt
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator className="my-8" />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">行ったイベント</h2>
          <span className="text-xs text-muted-foreground">
            {reports.length} 件
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            まだレポートはありません。参加したイベントのページから
            <br />
            「行ってきた / 感想を投稿」できます。
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => {
              const ev = r.events;
              const photos = r.attended_photos ?? [];
              const firstPhoto = photos[0];
              return (
                <li key={r.id}>
                  <Link
                    href={ev ? `/events/${ev.id}` : "#"}
                    className="group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
                  >
                    {firstPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={reportPhotoUrl(firstPhoto.storage_path)}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                        no photo
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {ev && (
                          <Badge variant="secondary" className="text-xs">
                            {CATEGORY_LABELS[ev.category]}
                          </Badge>
                        )}
                        <time className="text-xs text-muted-foreground">
                          {formatAttendedDate(r.attended_on)}
                        </time>
                        {r.rating != null && (
                          <span className="text-xs text-amber-500">
                            {"★".repeat(r.rating)}
                          </span>
                        )}
                        {photos.length > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{photos.length - 1} 枚
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-sm font-semibold">
                        {ev?.title ?? "(削除されたイベント)"}
                      </p>
                      {r.memo && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {r.memo}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Separator className="my-8" />

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/me/interests"
          className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">興味タグ</h2>
            <span className="text-xs text-muted-foreground group-hover:text-foreground">
              編集 →
            </span>
          </div>
          {interestCategories.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              好きなジャンルを設定すると、ホームで優先表示されます。
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {interestCategories.map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">
                  {CATEGORY_LABELS[c]}
                </Badge>
              ))}
            </div>
          )}
        </Link>
        <Link
          href="/me/notifications"
          className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">通知設定</h2>
            <span className="text-xs text-muted-foreground group-hover:text-foreground">
              設定 →
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            開催リマインダーや興味マッチの新着を通知します。
          </p>
        </Link>
        <PlaceholderCard
          title="位置情報レコメンド"
          description="近くで開催されるイベントを通知します。"
        />
      </section>

      <Separator className="my-8" />

      <form action={signOut}>
        <Button type="submit" variant="outline">
          ログアウト
        </Button>
      </form>
    </div>
  );
}

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          soon
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
