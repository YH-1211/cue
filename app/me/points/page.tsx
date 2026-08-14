import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { RankBadge } from "@/components/rank-badge";
import { rankFor, nextRank } from "@/lib/rank";

export const metadata = { title: "ランク・ポイント" };

type PointTransactionRow = {
  id: string;
  delta: number;
  reason: string;
  ref_event_id: string | null;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  event_approved: "イベント承認ボーナス",
  report_posted: "レポート投稿ボーナス",
};

function formatPointDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export default async function PointsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/points");
  }

  const [profileRes, pointHistoryRes] = await Promise.all([
    supabase.from("profiles").select("points").eq("id", user.id).maybeSingle(),
    supabase
      .from("point_transactions")
      .select("id, delta, reason, ref_event_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const points = profileRes.data?.points ?? 0;
  const pointHistory = (pointHistoryRes.data ?? []) as PointTransactionRow[];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <Link href="/me" className="text-muted-foreground hover:text-foreground">
          ← マイページに戻る
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          ランク・ポイント
        </h1>
      </header>

      <RankProgress points={points} />

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">ポイント履歴</h2>
          <span className="text-xs text-muted-foreground">残高 {points} pt</span>
        </div>

        {pointHistory.length === 0 ? (
          <EmptyState
            icon={<Coins aria-hidden className="size-8" />}
            title="まだ履歴がありません。"
          >
            投稿が承認されると +10pt が加算されます。
          </EmptyState>
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
    </div>
  );
}

function RankProgress({ points }: { points: number }) {
  const rank = rankFor(points);
  const next = nextRank(points);

  const lower = rank.minPoints;
  const upper = next ? next.rank.minPoints : lower;
  const ratio =
    next && upper > lower ? Math.min(1, (points - lower) / (upper - lower)) : 1;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <RankBadge points={points} />
        {next ? (
          <span className="text-xs text-muted-foreground">
            次の「{next.rank.icon} {next.rank.label}」まであと{" "}
            <span className="font-semibold text-foreground">
              {next.remaining}pt
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">最高ランク到達 🎉</span>
        )}
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        イベントを投稿して承認されると{" "}
        <span className="font-medium text-foreground">+10pt</span>、参加レポートを
        投稿すると <span className="font-medium text-foreground">+5pt</span>。
        貯まったポイントで称号がランクアップします。
      </p>
    </div>
  );
}
