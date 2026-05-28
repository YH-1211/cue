import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORY_LABELS, type EventCategory } from "@/lib/events";
import { formatRelativeTime } from "@/lib/relative-time";
import { DeleteButton, EnableToggle, RunNowButton } from "./row-actions";

export const metadata = { title: "取り込みソース管理" };
export const dynamic = "force-dynamic";

type SourceRow = {
  id: string;
  name: string;
  kind: "rss" | "atom" | "ical" | "json";
  url: string;
  category_default: EventCategory;
  area_default: string | null;
  target_table: "events" | "news_items";
  enabled: boolean;
  auto_approve: boolean;
  include_pattern: string | null;
  exclude_pattern: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_count: number | null;
  last_error: string | null;
};

export default async function SourcesPage() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_sources")
    .select(
      "id, name, kind, url, category_default, area_default, target_table, enabled, auto_approve, include_pattern, exclude_pattern, last_run_at, last_status, last_count, last_error"
    )
    .order("created_at", { ascending: true });

  const sources = (data ?? []) as SourceRow[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">取り込みソース</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            RSS/Atom 等の外部フィードを登録すると、Cron が定期取り込みします。
          </p>
        </div>
        <Link
          href="/admin/sources/new"
          className={buttonVariants({ size: "sm" })}
        >
          + 新規追加
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          読み込みに失敗しました: {error.message}
        </div>
      )}

      {sources.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          まだソースがありません。「+ 新規追加」から登録してください。
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {sources.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{s.name}</h2>
                  <Badge variant="outline" className="text-xs uppercase">
                    {s.kind}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {s.target_table === "news_items" ? "ニュース" : "イベント"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[s.category_default]}
                  </Badge>
                  {s.area_default && (
                    <span className="text-xs text-muted-foreground">
                      {s.area_default}
                    </span>
                  )}
                  {s.auto_approve && (
                    <Badge className="text-xs">自動承認</Badge>
                  )}
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {s.url}
                </a>
              </div>
              <EnableToggle id={s.id} enabled={s.enabled} />
            </div>

            {(s.include_pattern || s.exclude_pattern) && (
              <div className="mt-3 flex flex-col gap-1 rounded-lg bg-muted/50 p-2 text-xs">
                {s.include_pattern && (
                  <code className="text-emerald-700 dark:text-emerald-400">
                    include: {s.include_pattern}
                  </code>
                )}
                {s.exclude_pattern && (
                  <code className="text-red-700 dark:text-red-400">
                    exclude: {s.exclude_pattern}
                  </code>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {s.last_run_at ? (
                  <>
                    最終実行: {formatRelativeTime(s.last_run_at)}{" "}
                    {s.last_status === "ok" ? (
                      <span className="text-emerald-600">
                        ✓ {s.last_count ?? 0} 件
                      </span>
                    ) : (
                      <span className="text-red-600">✕ エラー</span>
                    )}
                  </>
                ) : (
                  <span>未実行</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <RunNowButton id={s.id} />
                <Link
                  href={`/admin/sources/${s.id}/edit`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  編集
                </Link>
                <DeleteButton id={s.id} name={s.name} />
              </div>
            </div>

            {s.last_error && (
              <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-red-500/5 p-2 text-[10px] text-red-700 dark:text-red-400">
                {s.last_error}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
