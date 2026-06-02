import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { CATEGORY_LABELS, type EventCategory } from "@/lib/events";
import { Badge } from "@/components/ui/badge";
import { ApproveButton, RejectButton, DeleteButton } from "./buttons";

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
  submitted_by: string | null;
};

function formatSubmitter(
  ev: { submitted_by: string | null; source_type: string },
  names: Map<string, string>
): string {
  if (ev.submitted_by) {
    return `投稿者: ${names.get(ev.submitted_by) ?? "不明なユーザー"}`;
  }
  return `自動取り込み (${ev.source_type})`;
}

export default async function ModerationPage() {
  await requireAdmin();

  const admin = createAdminClient();
  const cols =
    "id, title, description, category, area, venue_name, starts_at, official_url, source_type, created_at, submitted_by";

  const [pendingRes, approvedRes] = await Promise.all([
    admin
      .from("events")
      .select(cols)
      .eq("approved", false)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("events")
      .select(cols)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const error = pendingRes.error ?? approvedRes.error;
  const events = (pendingRes.data ?? []) as PendingEvent[];
  const approvedEvents = (approvedRes.data ?? []) as PendingEvent[];

  // 投稿者 (submitted_by) の表示名をまとめて取得
  const submitterIds = Array.from(
    new Set(
      [...events, ...approvedEvents]
        .map((e) => e.submitted_by)
        .filter((v): v is string => !!v)
    )
  );
  const names = new Map<string, string>();
  if (submitterIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", submitterIds);
    for (const p of profiles ?? []) {
      const row = p as { id: string; display_name: string | null };
      names.set(row.id, row.display_name || "名無しさん");
    }
  }

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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatSubmitter(ev, names)}
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

      <header className="mb-4 mt-12">
        <h2 className="text-xl font-bold tracking-tight">公開中のイベント</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          承認済み {approvedEvents.length} 件 (新しい順・最大100件)。投稿者の確認と削除ができます。
        </p>
      </header>

      {approvedEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          公開中のイベントはありません。
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {approvedEvents.map((ev) => (
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

              <h3 className="mt-2 text-base font-semibold leading-snug">
                <Link
                  href={`/events/${ev.id}`}
                  className="hover:underline"
                >
                  {ev.title}
                </Link>
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                開始: {new Date(ev.starts_at).toLocaleString("ja-JP")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatSubmitter(ev, names)}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={ev.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  元記事を開く ↗
                </Link>
                <DeleteButton id={ev.id} title={ev.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
