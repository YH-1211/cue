import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  type EventCategory,
} from "@/lib/events";

export const metadata = { title: "行ったイベント" };

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

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/reports");
  }

  const { data } = await supabase
    .from("attended_events")
    .select(
      `
        id, attended_on, rating, memo, created_at,
        events ( id, title, starts_at, category ),
        attended_photos ( id, storage_path )
      `
    )
    .eq("user_id", user.id)
    .order("attended_on", { ascending: false });

  const reports = (data ?? []) as unknown as ReportListRow[];
  const reportPhotoUrl = (path: string) =>
    supabase.storage.from("event-reports").getPublicUrl(path).data.publicUrl;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <Link href="/me" className="text-muted-foreground hover:text-foreground">
          ← マイページに戻る
        </Link>
      </nav>

      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          行ったイベント
        </h1>
        <span className="text-xs text-muted-foreground">{reports.length} 件</span>
      </header>

      {reports.length === 0 ? (
        <EmptyState title="まだレポートはありません。">
          参加したイベントのページから「行ってきた / 感想を投稿」できます。
        </EmptyState>
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
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded">
                      <Image
                        src={reportPhotoUrl(firstPhoto.storage_path)}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                      no photo
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {ev && (
                        <Badge
                          variant="secondary"
                          className={`text-xs ${categoryBadgeClass(ev.category)}`}
                        >
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
    </div>
  );
}
