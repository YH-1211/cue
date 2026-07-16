import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  type EventCategory,
} from "@/lib/events";

export const metadata = { title: "管理 / アクセス分析" };
export const dynamic = "force-dynamic";

type StatRow = {
  event_id: string;
  views: number;
  unique_views: number;
  official_clicks: number;
  ticket_clicks: number;
  shares: number;
};

type EventRow = {
  id: string;
  title: string;
  category: EventCategory;
  starts_at: string;
};

// 期間フィルタの選択肢
const PERIODS = [
  { key: "7", label: "直近7日", days: 7 },
  { key: "30", label: "直近30日", days: 30 },
  { key: "all", label: "全期間", days: null as number | null },
];

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  const { days: daysParam } = await searchParams;
  const period =
    PERIODS.find((p) => p.key === daysParam) ??
    PERIODS.find((p) => p.key === "30")!;
  const days = period.days;

  const admin = createAdminClient();

  // イベントごとの表示・クリック集計（RPC）
  const { data: statData, error: statErr } = await admin.rpc("get_event_stats", {
    days,
  });
  const stats = (statData ?? []) as StatRow[];

  // 保存数（saved_events）を期間で絞って集計
  let savedQuery = admin.from("saved_events").select("event_id, created_at");
  if (days != null) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    savedQuery = savedQuery.gte("created_at", since);
  }
  const { data: savedRows } = await savedQuery;
  const saveCount = new Map<string, number>();
  for (const r of (savedRows ?? []) as { event_id: string }[]) {
    saveCount.set(r.event_id, (saveCount.get(r.event_id) ?? 0) + 1);
  }

  // 対象イベント（何らかの指標がある／保存があるもの）のタイトルを取得
  const ids = [
    ...new Set([...stats.map((s) => s.event_id), ...saveCount.keys()]),
  ];
  const { data: eventRows } = ids.length
    ? await admin
        .from("events")
        .select("id, title, category, starts_at")
        .in("id", ids)
    : { data: [] as EventRow[] };
  const events = new Map(
    ((eventRows ?? []) as EventRow[]).map((e) => [e.id, e])
  );

  // 行を組み立て（表示回数の多い順）
  const statMap = new Map(stats.map((s) => [s.event_id, s]));
  const rows = ids
    .map((id) => {
      const s = statMap.get(id);
      return {
        event: events.get(id),
        views: s?.views ?? 0,
        unique: s?.unique_views ?? 0,
        official: s?.official_clicks ?? 0,
        ticket: s?.ticket_clicks ?? 0,
        saves: saveCount.get(id) ?? 0,
      };
    })
    .filter((r) => r.event) // タイトルが取れないもの（削除済み等）は除外
    .sort((a, b) => b.views - a.views || b.saves - a.saves);

  // 全体サマリー
  const total = rows.reduce(
    (acc, r) => {
      acc.views += r.views;
      acc.unique += r.unique;
      acc.official += r.official;
      acc.ticket += r.ticket;
      acc.saves += r.saves;
      return acc;
    },
    { views: 0, unique: 0, official: 0, ticket: 0, saves: 0 }
  );

  const maxViews = rows.reduce((m, r) => Math.max(m, r.views), 0);

  const summary = [
    { label: "総表示", value: total.views, hint: `ユニーク ${total.unique.toLocaleString()}` },
    { label: "公式サイト送客", value: total.official, hint: `CTR ${pct(total.official, total.views)}` },
    { label: "チケット遷移", value: total.ticket, hint: `CTR ${pct(total.ticket, total.views)}` },
    { label: "保存", value: total.saves, hint: `保存率 ${pct(total.saves, total.views)}` },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </nav>

      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">アクセス分析</h1>
        <p className="text-sm text-muted-foreground">
          各イベントの表示回数・公式サイトへの送客・保存を集計しています。個人は特定していません（匿名の集計）。
        </p>
      </header>

      {/* 期間切り替え */}
      <div className="mb-6 flex flex-wrap gap-2">
        {PERIODS.map((p) => {
          const active = p.key === period.key;
          return (
            <Link
              key={p.key}
              href={`/admin/analytics?days=${p.key}`}
              className={
                "rounded-full border px-4 py-1.5 text-sm transition-colors " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {statErr && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          取得エラー: {statErr.message}
        </div>
      )}

      {/* サマリーカード */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((c) => (
          <div
            key={c.label}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
          >
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <span className="text-2xl font-bold tabular-nums">
              {c.value.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">{c.hint}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 && !statErr && (
        <EmptyState title="この期間の計測データはまだありません。" />
      )}

      {/* イベント別テーブル */}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">イベント</th>
                <th className="px-3 py-3 text-right font-medium">表示</th>
                <th className="px-3 py-3 text-right font-medium">ユニーク</th>
                <th className="px-3 py-3 text-right font-medium">公式送客</th>
                <th className="px-3 py-3 text-right font-medium">チケット</th>
                <th className="px-3 py-3 text-right font-medium">保存</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = r.event!;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/events/${e.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {e.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={
                            "inline-block rounded px-1.5 py-0.5 text-[10px] " +
                            categoryBadgeClass(e.category)
                          }
                        >
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </span>
                        {/* 表示回数の相対バー */}
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{
                              width:
                                maxViews > 0
                                  ? `${(r.views / maxViews) * 100}%`
                                  : "0%",
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">
                      {r.views.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {r.unique.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.official.toLocaleString()}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {pct(r.official, r.views)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {r.ticket.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {r.saves.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        ※ 表示は同一利用者の連続リロードを30分単位でまとめています。ユニークは概算の端末数です。
      </p>
    </div>
  );
}
