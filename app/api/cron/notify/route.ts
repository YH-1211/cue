import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendPushToUser } from "@/lib/web-push";
import { CATEGORY_LABELS, type EventCategory } from "@/lib/events";
import {
  AREA_COORDS,
  nearbyAreas,
  type AreaName,
} from "@/lib/tokyo-areas";

function isAreaName(s: string): s is AreaName {
  return s in AREA_COORDS;
}

// Cron は最大数十秒で完了させたい。Edge ではなく Node ランタイムで動かす。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavedEventRow = {
  user_id: string;
  notify_event_reminder: boolean;
  events: {
    id: string;
    title: string;
    starts_at: string;
    venue_name: string | null;
    area: string | null;
  } | null;
};

type EventForTicket = {
  id: string;
  title: string;
  ticket_sale_starts_at: string | null;
};

function isAuthorized(req: NextRequest) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を付ける
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 開発中は未設定でも通す
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const result = {
    reminder_eve: 0,
    reminder_morning: 0,
    ticket_24h: 0,
    ticket_1h: 0,
    ticket_now: 0,
    interest_weekly: 0,
    nearby_match: 0,
  };

  // ============================================
  // 1) 開催前リマインダー (前夜: 18:00〜23:00 帯で1回)
  //    現在時刻が 18 時台以降で、明日開催のイベントが対象
  // ============================================
  if (now.getHours() >= 18) {
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    result.reminder_eve = await sendReminders(admin, {
      kind: "reminder_eve",
      prefColumn: "notify_reminder_eve",
      titlePrefix: "明日開催:",
      from: tomorrowStart,
      to: tomorrowEnd,
    });
  }

  // ============================================
  // 2) 当日リマインダー (朝: 7:00〜11:00 帯で1回)
  // ============================================
  if (now.getHours() >= 7 && now.getHours() < 12) {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    result.reminder_morning = await sendReminders(admin, {
      kind: "reminder_morning",
      prefColumn: "notify_reminder_morning",
      titlePrefix: "今日開催:",
      from: todayStart,
      to: todayEnd,
    });
  }

  // ============================================
  // 3) チケット発売通知 (24h前 / 1h前 / 同時)
  // ============================================
  result.ticket_24h = await sendTicketSale(admin, "ticket_24h", 24 * 60);
  result.ticket_1h = await sendTicketSale(admin, "ticket_1h", 60);
  result.ticket_now = await sendTicketSale(admin, "ticket_now", 0);

  // ============================================
  // 4) 興味マッチ新着 (週1: 月曜 朝 9 時台に1回)
  // ============================================
  if (now.getDay() === 1 && now.getHours() === 9) {
    result.interest_weekly = await sendInterestWeekly(admin);
  }

  // ============================================
  // 5) 近隣マッチ (日次: 朝 9 時帯に1回)
  //    home_area × 興味タグ × 過去24h の新着
  // ============================================
  if (now.getHours() === 9) {
    result.nearby_match = await sendNearbyMatch(admin);
  }

  return NextResponse.json({ ok: true, now: now.toISOString(), result });
}

// =====================================================
// リマインダー送信
// =====================================================
async function sendReminders(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    kind: "reminder_eve" | "reminder_morning";
    prefColumn: "notify_reminder_eve" | "notify_reminder_morning";
    titlePrefix: string;
    from: Date;
    to: Date;
  }
) {
  // 行きたい登録 × 期間内開催 を抽出
  const { data, error } = await admin
    .from("saved_events")
    .select(
      `user_id, notify_event_reminder,
       events!inner ( id, title, starts_at, venue_name, area )`
    )
    .gte("events.starts_at", opts.from.toISOString())
    .lte("events.starts_at", opts.to.toISOString())
    .eq("events.approved", true);

  if (error || !data) {
    console.error("reminder query", error);
    return 0;
  }

  let sent = 0;
  for (const row of data as unknown as SavedEventRow[]) {
    const ev = row.events;
    if (!ev || !row.notify_event_reminder) continue;

    // ユーザー側の prefs
    const { data: profile } = await admin
      .from("profiles")
      .select(opts.prefColumn)
      .eq("id", row.user_id)
      .maybeSingle();
    if (!profile || !(profile as Record<string, boolean>)[opts.prefColumn]) continue;

    // 重複防止
    const dup = await admin
      .from("notification_log")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("kind", opts.kind)
      .eq("event_id", ev.id)
      .maybeSingle();
    if (dup.data) continue;

    const time = new Date(ev.starts_at).toLocaleString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const place = [ev.area, ev.venue_name].filter(Boolean).join(" / ");

    const ok = await sendPushToUser(admin, row.user_id, {
      title: `${opts.titlePrefix} ${ev.title}`,
      body: place ? `${time} · ${place}` : time,
      url: `/events/${ev.id}`,
      tag: `${opts.kind}:${ev.id}`,
    });
    if (ok > 0) {
      await admin
        .from("notification_log")
        .insert({ user_id: row.user_id, kind: opts.kind, event_id: ev.id });
      sent += 1;
    }
  }
  return sent;
}

// =====================================================
// チケット発売通知
// =====================================================
async function sendTicketSale(
  admin: ReturnType<typeof createAdminClient>,
  kind: "ticket_24h" | "ticket_1h" | "ticket_now",
  minutesAhead: number
) {
  const now = new Date();
  // [target - 30min, target + 30min] の窓
  const target = new Date(now.getTime() + minutesAhead * 60 * 1000);
  const windowMs = 30 * 60 * 1000;
  const from = new Date(target.getTime() - windowMs);
  const to = new Date(target.getTime() + windowMs);

  const col =
    kind === "ticket_24h"
      ? "notify_ticket_24h"
      : kind === "ticket_1h"
        ? "notify_ticket_1h"
        : "notify_ticket_now";

  const { data, error } = await admin
    .from("saved_events")
    .select(
      `user_id, ${col},
       events!inner ( id, title, ticket_sale_starts_at )`
    )
    .gte("events.ticket_sale_starts_at", from.toISOString())
    .lte("events.ticket_sale_starts_at", to.toISOString())
    .eq("events.approved", true);

  if (error || !data) return 0;

  let sent = 0;
  for (const row of data as unknown as Array<
    Record<string, unknown> & {
      user_id: string;
      events: EventForTicket | null;
    }
  >) {
    const ev = row.events;
    const enabled = row[col] as boolean;
    if (!ev || !enabled || !ev.ticket_sale_starts_at) continue;

    // ユーザー側 prefs (notify_ticket) でも一括 OFF できる
    const { data: profile } = await admin
      .from("profiles")
      .select("notify_ticket")
      .eq("id", row.user_id)
      .maybeSingle();
    if (!profile?.notify_ticket) continue;

    // 重複防止
    const dup = await admin
      .from("notification_log")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("kind", kind)
      .eq("event_id", ev.id)
      .maybeSingle();
    if (dup.data) continue;

    const label =
      kind === "ticket_24h"
        ? "明日チケット発売:"
        : kind === "ticket_1h"
          ? "もうすぐチケット発売:"
          : "チケット発売中:";

    const ok = await sendPushToUser(admin, row.user_id, {
      title: `${label} ${ev.title}`,
      body: new Date(ev.ticket_sale_starts_at).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      url: `/events/${ev.id}`,
      tag: `${kind}:${ev.id}`,
    });
    if (ok > 0) {
      await admin
        .from("notification_log")
        .insert({ user_id: row.user_id, kind, event_id: ev.id });
      sent += 1;
    }
  }
  return sent;
}

// =====================================================
// 興味マッチ新着 (週1)
// =====================================================
async function sendInterestWeekly(
  admin: ReturnType<typeof createAdminClient>
) {
  const sinceDays = 7;
  const sinceMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const since = new Date(sinceMs);

  // 興味タグを持ち、weekly ON のユーザー
  const { data: users } = await admin
    .from("profiles")
    .select("id, interest_categories")
    .eq("notify_interest_weekly", true)
    .not("interest_categories", "is", null);

  if (!users || users.length === 0) return 0;

  let sent = 0;
  for (const u of users as Array<{ id: string; interest_categories: EventCategory[] | null }>) {
    const cats = u.interest_categories ?? [];
    if (cats.length === 0) continue;

    // 過去7日に作られた、興味カテゴリに合う、未来開催のイベント
    const { data: events } = await admin
      .from("events")
      .select("id, title, category")
      .eq("approved", true)
      .in("category", cats)
      .gte("created_at", since.toISOString())
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5);

    if (!events || events.length === 0) continue;

    // 同じ週は1回まで
    const dup = await admin
      .from("notification_log")
      .select("id")
      .eq("user_id", u.id)
      .eq("kind", "interest_weekly")
      .gte("sent_at", since.toISOString())
      .maybeSingle();
    if (dup.data) continue;

    const top = events[0];
    const more = events.length - 1;
    const ok = await sendPushToUser(admin, u.id, {
      title: `あなた向けの今週の新着 (${events.length} 件)`,
      body: more > 0
        ? `${CATEGORY_LABELS[top.category as EventCategory]} ${top.title} ほか ${more} 件`
        : `${CATEGORY_LABELS[top.category as EventCategory]} ${top.title}`,
      url: "/events",
      tag: "interest_weekly",
    });
    if (ok > 0) {
      await admin
        .from("notification_log")
        .insert({ user_id: u.id, kind: "interest_weekly", event_id: null });
      sent += 1;
    }
  }
  return sent;
}

// =====================================================
// 近隣マッチ (日次): home_area × 興味カテゴリ × 過去24h 新着
// =====================================================
async function sendNearbyMatch(
  admin: ReturnType<typeof createAdminClient>
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // home_area が設定済みかつ近隣マッチ通知 ON
  const { data: users, error } = await admin
    .from("profiles")
    .select(
      "id, interest_categories, home_area, home_radius_km, notify_nearby_match"
    )
    .eq("notify_nearby_match", true)
    .not("home_area", "is", null);

  if (error || !users || users.length === 0) return 0;

  let sent = 0;
  for (const u of users as Array<{
    id: string;
    interest_categories: EventCategory[] | null;
    home_area: string | null;
    home_radius_km: number | null;
  }>) {
    if (!u.home_area || !isAreaName(u.home_area)) continue;

    const origin = AREA_COORDS[u.home_area];
    const radius = u.home_radius_km ?? 5;
    const nearby = nearbyAreas(origin, radius).map((a) => a.area);
    if (nearby.length === 0) continue;

    const cats = u.interest_categories ?? [];

    // 過去24h に作成された未来開催の承認済イベント
    let query = admin
      .from("events")
      .select("id, title, category, area, starts_at")
      .eq("approved", true)
      .in("area", nearby)
      .gte("created_at", since.toISOString())
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10);
    if (cats.length > 0) query = query.in("category", cats);

    const { data: events } = await query;
    if (!events || events.length === 0) continue;

    // 既に nearby_match で送ったイベントは除外
    const ids = events.map((e) => e.id);
    const { data: sentLogs } = await admin
      .from("notification_log")
      .select("event_id")
      .eq("user_id", u.id)
      .eq("kind", "nearby_match")
      .in("event_id", ids);
    const sentSet = new Set((sentLogs ?? []).map((r) => r.event_id as string));
    const fresh = events.filter((e) => !sentSet.has(e.id));
    if (fresh.length === 0) continue;

    const top = fresh[0];
    const more = fresh.length - 1;
    const ok = await sendPushToUser(admin, u.id, {
      title: `近くで新着 (${fresh.length}件)`,
      body:
        more > 0
          ? `${CATEGORY_LABELS[top.category as EventCategory]} ${top.title} ほか ${more} 件`
          : `${CATEGORY_LABELS[top.category as EventCategory]} ${top.title}`,
      url: `/events?area=${encodeURIComponent(u.home_area)}`,
      tag: "nearby_match",
    });
    if (ok > 0) {
      // 送ったイベントを全部 log に記録 (重複防止)
      await admin.from("notification_log").insert(
        fresh.map((e) => ({
          user_id: u.id,
          kind: "nearby_match",
          event_id: e.id,
        }))
      );
      sent += 1;
    }
  }
  return sent;
}
