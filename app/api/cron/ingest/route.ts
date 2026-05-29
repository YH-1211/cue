import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { ingestSource, type IngestSource } from "@/lib/ingest";

// 取り込みは外部 HTTP を伴うため Node ランタイム + 長め
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 開発中は素通り
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date();

  try {
    const { data: sources, error } = await admin
      .from("event_sources")
      .select("*")
      .eq("enabled", true);

    if (error) {
      await logCronRun(admin, {
        startedAt,
        ok: false,
        summary: null,
        error: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const results: Array<{
      source: string;
      status: "ok" | "error";
      count: number;
      error?: string;
    }> = [];

    for (const src of (sources ?? []) as IngestSource[]) {
      const srcStartedAt = new Date().toISOString();
      try {
        const count = await ingestSource(admin, src);
        results.push({ source: src.name, status: "ok", count });
        await admin
          .from("event_sources")
          .update({
            last_run_at: srcStartedAt,
            last_status: "ok",
            last_count: count,
            last_error: null,
          })
          .eq("id", src.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ source: src.name, status: "error", count: 0, error: msg });
        await admin
          .from("event_sources")
          .update({
            last_run_at: srcStartedAt,
            last_status: "error",
            last_count: 0,
            last_error: msg.slice(0, 500),
          })
          .eq("id", src.id);
      }
    }

    // 30日より古いニュースを掃除
    let purged: number | null = null;
    try {
      const { data: purgedCount, error: purgeErr } = await admin.rpc(
        "purge_old_news",
        { days: 30 }
      );
      if (purgeErr) {
        console.warn("[ingest:purge] failed", purgeErr.message);
      } else {
        purged = (purgedCount as number) ?? 0;
      }
    } catch (e) {
      console.warn("[ingest:purge] threw", e);
    }

    const totalCount = results.reduce((acc, r) => acc + (r.count ?? 0), 0);
    const okCount = results.filter((r) => r.status === "ok").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    await logCronRun(admin, {
      startedAt,
      ok: errorCount === 0,
      summary: {
        sources_total: sources?.length ?? 0,
        sources_ok: okCount,
        sources_error: errorCount,
        count: totalCount,
        purged_news: purged,
        results,
      },
      error: null,
    });

    return NextResponse.json({
      ok: true,
      sources_total: sources?.length ?? 0,
      results,
      purged_news: purged,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun(admin, {
      startedAt,
      ok: false,
      summary: null,
      error: msg,
    });
    throw e;
  }
}

async function logCronRun(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    startedAt: Date;
    ok: boolean;
    summary: Record<string, unknown> | null;
    error: string | null;
  }
) {
  try {
    await admin.from("cron_run_logs").insert({
      kind: "ingest",
      started_at: args.startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      ok: args.ok,
      summary: args.summary,
      error: args.error ? args.error.slice(0, 2000) : null,
    });
  } catch (e) {
    console.warn("[ingest:log] failed", e);
  }
}
