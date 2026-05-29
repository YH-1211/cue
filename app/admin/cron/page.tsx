import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/relative-time";

export const metadata = { title: "Cron 実行履歴" };
export const dynamic = "force-dynamic";

type CronRunLogRow = {
  id: string;
  kind: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  summary: Record<string, unknown> | null;
  error: string | null;
};

type DayBucket = {
  day: string; // YYYY-MM-DD (JST)
  ok: number;
  error: number;
};

const KIND_LABELS: Record<string, string> = {
  ingest: "取り込み (ingest)",
  notify: "通知 (notify)",
};

function toJstDayKey(iso: string): string {
  // JST = UTC+9 で日付に丸める
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function lastNDayKeys(n: number, nowMs: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * 24 * 60 * 60 * 1000);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    keys.push(jst.toISOString().slice(0, 10));
  }
  return keys;
}

function bucketByDay(rows: CronRunLogRow[], days: string[]): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const d of days) map.set(d, { day: d, ok: 0, error: 0 });
  for (const r of rows) {
    const k = toJstDayKey(r.started_at);
    const b = map.get(k);
    if (!b) continue;
    if (r.ok === true) b.ok += 1;
    else if (r.ok === false) b.error += 1;
  }
  return days.map((d) => map.get(d)!);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationMs(started: string, finished: string | null) {
  if (!finished) return null;
  return new Date(finished).getTime() - new Date(started).getTime();
}

function compactSummary(summary: Record<string, unknown> | null): string {
  if (!summary) return "-";
  const json = JSON.stringify(summary);
  if (json.length <= 120) return json;
  return json.slice(0, 117) + "...";
}

export default async function CronPage() {
  await requireAdmin();

  const admin = createAdminClient();

  // 過去 30 日 (JST 基準) で取得用に UTC 切り上げで広めに 31 日前以降
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const since = new Date(nowMs - 31 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("cron_run_logs")
    .select("id, kind, started_at, finished_at, ok, summary, error")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as CronRunLogRow[];
  const kinds = Array.from(new Set(rows.map((r) => r.kind))).sort();
  const days = lastNDayKeys(30, nowMs);
  const recent = rows.slice(0, 20);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Cron 実行履歴</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          過去 30 日の `cron_run_logs` を集計しています。1 行 = 1 回の実行。
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          読み込みに失敗しました: {error.message}
          <br />
          <span className="text-xs text-muted-foreground">
            (migration 0014 が未適用かもしれません)
          </span>
        </div>
      )}

      {kinds.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          まだログがありません。Cron が次に走ると記録されます。
        </div>
      )}

      <div className="flex flex-col gap-8">
        {kinds.map((kind) => {
          const kindRows = rows.filter((r) => r.kind === kind);
          const buckets = bucketByDay(kindRows, days);
          const max = Math.max(1, ...buckets.map((b) => b.ok + b.error));
          const totalOk = kindRows.filter((r) => r.ok === true).length;
          const totalErr = kindRows.filter((r) => r.ok === false).length;

          return (
            <section
              key={kind}
              className="rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {KIND_LABELS[kind] ?? kind}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    30 日合計: 成功 {totalOk} / 失敗 {totalErr}
                  </p>
                </div>
              </div>

              {/* 棒グラフ (純 CSS) */}
              <div className="flex h-32 items-end gap-[2px] rounded-lg bg-muted/30 p-2">
                {buckets.map((b) => {
                  const total = b.ok + b.error;
                  const okPct = (b.ok / max) * 100;
                  const errPct = (b.error / max) * 100;
                  return (
                    <div
                      key={b.day}
                      className="flex h-full min-w-0 flex-1 flex-col justify-end"
                      title={`${b.day}: 成功 ${b.ok} / 失敗 ${b.error}`}
                    >
                      <div
                        className="w-full bg-red-500"
                        style={{ height: `${errPct}%` }}
                      />
                      <div
                        className="w-full bg-emerald-500"
                        style={{ height: `${okPct}%` }}
                      />
                      {total === 0 && (
                        <div className="h-[1px] w-full bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>{buckets[0]?.day}</span>
                <span>{buckets[buckets.length - 1]?.day}</span>
              </div>

              <div className="mt-3 flex gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-sm bg-emerald-500" />
                  成功
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-sm bg-red-500" />
                  失敗
                </span>
              </div>
            </section>
          );
        })}
      </div>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold">最新 20 件</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">kind</th>
                  <th className="px-3 py-2">開始</th>
                  <th className="px-3 py-2">時間</th>
                  <th className="px-3 py-2">結果</th>
                  <th className="px-3 py-2">summary / error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((r) => {
                  const dur = durationMs(r.started_at, r.finished_at);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">
                          {r.kind}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div>{formatDateTime(r.started_at)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(r.started_at)}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs tabular-nums">
                        {dur != null ? `${dur} ms` : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {r.ok === true ? (
                          <Badge className="bg-emerald-500 text-xs hover:bg-emerald-500">
                            OK
                          </Badge>
                        ) : r.ok === false ? (
                          <Badge variant="destructive" className="text-xs">
                            ERROR
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            ?
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.error ? (
                          <pre className="max-h-24 overflow-auto rounded bg-red-500/5 p-1.5 text-[10px] text-red-700 dark:text-red-400">
                            {r.error}
                          </pre>
                        ) : (
                          <code className="block max-w-xl truncate text-[11px] text-muted-foreground">
                            {compactSummary(r.summary)}
                          </code>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
