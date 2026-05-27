import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { CATEGORY_LABELS, type EventCategory } from "@/lib/events";
import { Badge } from "@/components/ui/badge";
import { ApproveButton, RejectButton } from "./buttons";

export const metadata = { title: "モデレーション" };
export const dynamic = "force-dynamic";

type PendingEvent = {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  area: string | null;
  venue_name: string | null;
  starts_at: string;
  official_url: string;
  source_type: string;
  created_at: string;
};

export default async function ModerationPage() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .select(
      "id, title, description, category, area, venue_name, starts_at, official_url, source_type, created_at"
    )
    .eq("approved", false)
    .order("created_at", { ascending: false })
    .limit(100);

  const events = (data ?? []) as PendingEvent[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">モデレーション</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          未承認イベント {events.length} 件
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          読み込みに失敗しました: {error.message}
        </div>
      )}

      {events.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          未承認のイベントはありません 🎉
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABELS[ev.category]}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {ev.source_type}
              </Badge>
              {(ev.area || ev.venue_name) && (
                <span className="truncate text-xs text-muted-foreground">
                  {ev.area && `${ev.area} / `}
                  {ev.venue_name}
                </span>
              )}
            </div>

            <h2 className="mt-2 text-base font-semibold leading-snug">
              {ev.title}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              開始: {new Date(ev.starts_at).toLocaleString("ja-JP")}
            </p>

            {ev.description && (
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {ev.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Link
                href={ev.official_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                元記事を開く ↗
              </Link>
              <div className="flex gap-2">
                <RejectButton id={ev.id} />
                <ApproveButton id={ev.id} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
