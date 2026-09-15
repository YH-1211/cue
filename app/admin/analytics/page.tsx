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

// 日本時間の「今日の0時」を返す。
// サーバーのタイムゾーンに関係なく同じ境界になるよう UTC 上で計算する。
function jstStartOfToday(): Date {
  const shifted = new Date(Date.now() + 9 * 3600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 9 * 3600_000);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400_000);
}

// 期間フィルタの選択肢。since が null なら全期間。
const PERIODS = [
  { key: "today", label: "本日", since: jstStartOfToday },
  { key: "7", label: "直近7日", since: () => daysAgo(7) },
  { key: "30", label: "直近30日", since: () => daysAgo(30) },
  { key: "all", label: "全期間", since: () => null },
];

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

// 出現回数の多い順に上位5件を返す
function rank(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
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
  const since = period.since()?.toISOString() ?? null;

  const admin = createAdminClient();

  // イベントごとの表示・クリック集計（RPC）
  const { data: statData, error: statErr } = await admin.rpc("get_event_stats", {
    since,
  });
  const stats = (statData ?? []) as StatRow[];

  // サイト全体のページ閲覧（トップ・一覧・カレンダーを含む）
  let pageQuery = admin
    .from("page_views")
    .select("path, referrer_host, utm_source, session_id");
  if (since) pageQuery = pageQuery.gte("occurred_at", since);
  const { data: pageRows } = await pageQuery;
  const pageViews = (pageRows ?? []) as {
    path: string;
    referrer_host: string | null;
    utm_source: string | null;
    session_id: string | null;
  }[];

  const siteSessions = new Set(
    pageViews.map((v) => v.session_id).filter(Boolean)
  ).size;
  const topPaths = rank(pageViews.map((v) => v.path));
  // 流入元は広告パラメータを優先し、無ければリンク元ホスト名を使う
  const topSources = rank(
    pageViews
      .map((v) => v.utm_source ?? v.referrer_host)
      .filter((s): s is string => Boolean(s))
  );

  // 保存数（saved_events）を期間で絞って集計
  let savedQuery = admin.from("saved_events").select("event_id, created_at");
  if (since) savedQuery = savedQuery.gte("created_at", since);
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

      {/* サイト全体のアクセス（トップ・一覧・カレンダーを含む） */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">サイト全体のアクセス</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">ページ閲覧</span>
            <span className="text-2xl font-bold tabular-nums">
              {pageViews.length.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">
              全ページ合計
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">訪問者</span>
            <span className="text-2xl font-bold tabular-nums">
              {siteSessions.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">概算の端末数</span>
          </div>
          <div className="col-span-2 flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">流入元</span>
            {topSources.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                直接アクセスのみ
              </span>
            ) : (
              <ul className="mt-0.5 space-y-0.5 text-sm">
                {topSources.map(([name, count]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="truncate">{name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {topPaths.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">
              よく見られているページ
            </span>
            <ul className="mt-1 space-y-0.5 text-sm">
              {topPaths.map(([path, count]) => (
                <li key={path} className="flex justify-between gap-2">
                  <span className="truncate font-mono text-xs">{path}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* サマリーカード */}
      <h2 className="mb-3 text-sm font-semibold">イベント別の反応</h2>
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
        <br />
        ※ 「サイト全体のアクセス」の計測開始は2026年9月15日です。それ以前はイベント詳細ページしか記録していないため、遡って比較はできません。
      </p>
    </div>
  );
}
