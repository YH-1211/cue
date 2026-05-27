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

  const { data: sources, error } = await admin
    .from("event_sources")
    .select("*")
    .eq("enabled", true);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{
    source: string;
    status: "ok" | "error";
    count: number;
    error?: string;
  }> = [];

  for (const src of (sources ?? []) as IngestSource[]) {
    const startedAt = new Date().toISOString();
    try {
      const count = await ingestSource(admin, src);
      results.push({ source: src.name, status: "ok", count });
      await admin
        .from("event_sources")
        .update({
          last_run_at: startedAt,
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
          last_run_at: startedAt,
          last_status: "error",
          last_count: 0,
          last_error: msg.slice(0, 500),
        })
        .eq("id", src.id);
    }
  }

  return NextResponse.json({
    ok: true,
    sources_total: sources?.length ?? 0,
    results,
  });
}
