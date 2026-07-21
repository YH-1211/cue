import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { runHealthcheck } from "@/lib/healthcheck";
import { sendPushToAdmins } from "@/lib/web-push";

// 公式URLへの外部 HTTP を伴うため Node ランタイム + 長め
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
    const summary = await runHealthcheck(admin);

    await logCronRun(admin, {
      startedAt,
      ok: true,
      summary: { ...summary },
      error: null,
    });

    // 新しい要確認フラグが立ったら管理者に通知
    if (summary.new_flags > 0) {
      try {
        await sendPushToAdmins(admin, {
          title: "🔍 要確認イベントが見つかりました",
          body: `${summary.new_flags}件の新しい要確認フラグ（死リンク${summary.dead_link} / 日付ズレ${summary.date_mismatch} 等）`,
          url: "/admin/reviews",
          tag: "healthcheck",
        });
      } catch (e) {
        console.warn("[healthcheck:push] failed", e);
      }
    }

    return NextResponse.json({ ok: true, ...summary });
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
      kind: "healthcheck",
      started_at: args.startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      ok: args.ok,
      summary: args.summary,
      error: args.error ? args.error.slice(0, 2000) : null,
    });
  } catch (e) {
    console.warn("[healthcheck:log] failed", e);
  }
}
