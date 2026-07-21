import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/lib/relative-time";
import { FlagActions } from "./flag-actions";

export const metadata = { title: "管理 / 要確認リスト" };
export const dynamic = "force-dynamic";

type FlagStatus = "open" | "resolved" | "ignored";
type FlagSeverity = "info" | "warning" | "critical";
type FlagReason = "dead_link" | "date_mismatch" | "stale_soon" | "date_tbd";

type ReviewFlagRow = {
  id: string;
  event_id: string;
  reason: FlagReason;
  severity: FlagSeverity;
  detail: string | null;
  detected_url: string | null;
  status: FlagStatus;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  events: { title: string | null; official_url: string | null } | null;
};

const REASON_LABELS: Record<FlagReason, string> = {
  dead_link: "🔗 公式URLが死んでいる",
  date_mismatch: "📅 日付が公式と食い違う",
  stale_soon: "⏳ 開催間近なのに更新が古い",
  date_tbd: "❓ 日程未定",
};

const SEVERITY_META: Record<
  FlagSeverity,
  { label: string; className: string }
> = {
  critical: {
    label: "重要",
    className: "bg-red-600 text-white hover:bg-red-600",
  },
  warning: {
    label: "警告",
    className: "bg-amber-500 text-white hover:bg-amber-500",
  },
  info: {
    label: "情報",
    className: "bg-sky-500 text-white hover:bg-sky-500",
  },
};

const SEVERITY_ORDER: Record<FlagSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export default async function AdminReviewsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_review_flags")
    .select(
      "id, event_id, reason, severity, detail, detected_url, status, first_seen_at, last_seen_at, resolved_at, events(title, official_url)"
    )
    .order("last_seen_at", { ascending: false })
    .limit(500);

  const flags = (data ?? []) as unknown as ReviewFlagRow[];
  const open = flags
    .filter((f) => f.status === "open")
    .sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    );
  const handled = flags.filter((f) => f.status !== "open");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </nav>

      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">要確認リスト</h1>
        <p className="text-sm text-muted-foreground">
          日次ヘルスチェックが自動検出したイベントの問題です。未対応 {open.length} 件。
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          取得エラー: {error.message}
          <br />
          <span className="text-xs opacity-80">
            (migration 0038 が未適用かもしれません)
          </span>
        </div>
      ) : open.length === 0 && handled.length === 0 ? (
        <EmptyState title="要確認のイベントはありません。ヘルスチェックが問題を見つけると、ここに表示されます。" />
      ) : (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            {open.length === 0 ? (
              <EmptyState title="未対応の要確認はありません 🎉" />
            ) : (
              open.map((f) => <FlagCard key={f.id} flag={f} />)
            )}
          </section>

          {handled.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                対応済み / 無視 ({handled.length})
              </h2>
              {handled.map((f) => (
                <FlagCard key={f.id} flag={f} muted />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function FlagCard({ flag, muted }: { flag: ReviewFlagRow; muted?: boolean }) {
  const sev = SEVERITY_META[flag.severity];
  const title = flag.events?.title ?? "(削除されたイベント)";
  const officialUrl = flag.detected_url ?? flag.events?.official_url ?? null;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-border bg-card p-4 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={sev.className}>{sev.label}</Badge>
        <Badge variant="secondary">{REASON_LABELS[flag.reason]}</Badge>
        {flag.status === "resolved" && (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
            対応済み
          </Badge>
        )}
        {flag.status === "ignored" && (
          <Badge variant="outline">無視</Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatRelativeTime(flag.last_seen_at)}
        </span>
      </div>

      <div className="text-sm">
        <Link
          href={`/events/${flag.event_id}`}
          className="font-semibold underline-offset-2 hover:underline"
        >
          {title}
        </Link>
      </div>

      {flag.detail && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {flag.detail}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-foreground underline underline-offset-2"
          >
            公式URLを開く ↗
          </a>
        )}
        <span className="ml-auto">
          <FlagActions id={flag.id} status={flag.status} />
        </span>
      </div>
    </div>
  );
}
