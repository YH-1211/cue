import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { notifyUser } from "@/lib/notify";
import { jstParts, jstDateToUtc } from "@/lib/datetime";
import {
  CATEGORY_LABELS,
  categoriesUnderParent,
  isParentCategory,
  eventScheduleLabel,
  type EventCategory,
} from "@/lib/events";
import { broadcastLineMessage } from "@/lib/line";
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

type EventForTicketEnd = {
  id: string;
  title: string;
  ticket_sale_ends_at: string | null;
};

function isAuthorized(req: NextRequest) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を付ける
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 開発中は未設定でも通す
  return auth === `Bearer ${secret}`;
}

type QuietPrefs = {
  notify_quiet_hours_enabled: boolean | null;
  notify_quiet_hours_start: number | null;
  notify_quiet_hours_end: number | null;
};

// 現在の JST 時刻が user の静音時間内なら true (= 送信を控える)
function isQuietNow(prefs: QuietPrefs | null, now: Date): boolean {
  if (!prefs || !prefs.notify_quiet_hours_enabled) return false;
  const start = prefs.notify_quiet_hours_start ?? 22;
  const end = prefs.notify_quiet_hours_end ?? 7;
  if (start === end) return false; // 無効扱い
  // JST の「時」を取得 (Cron は UTC で動く想定。+9h)
  const jstHour = (now.getUTCHours() + 9) % 24;
  if (start < end) {
    // 例: 1〜6 → その範囲内
    return jstHour >= start && jstHour < end;
  }
  // 日跨ぎ 例: 22〜7 → 22,23,0..6
  return jstHour >= start || jstHour < end;
}

// 複数ユーザーの profiles を 1 クエリでまとめて取得し、id → row の Map にする。
// ループ内で 1 件ずつ問い合わせる N+1 を避けるためのヘルパー。
async function fetchProfilesByIds(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
  columns: string
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return map;
  const { data } = await admin
    .from("profiles")
    .select(`id, ${columns}`)
    .in("id", unique);
  for (const p of (data ?? []) as unknown as Array<
    Record<string, unknown> & { id: string }
  >) {
    map.set(p.id, p);
  }
  return map;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = new Date();
  const now = startedAt;
  // cron は UTC で起動するため、時間帯ゲートは必ず JST に換算して判定する。
  const jst = jstParts(now);
  const result = {
    reminder_eve: 0,
    reminder_morning: 0,
    ticket_24h: 0,
    ticket_1h: 0,
    ticket_now: 0,
    ticket_end_3d: 0,
    ticket_end_1d: 0,
    ticket_end_soon: 0,
    ticket_end_over: 0,
    interest_weekly: 0,
    interest_digest: 0,
    line_weekly: 0,
    interest_upcoming_7d: 0,
    interest_upcoming_1d: 0,
    interest_upcoming_morning: 0,
    interest_ticket_24h: 0,
    nearby_match: 0,
    saved_search: 0,
  };

  try {

  // ============================================
  // 1) 開催前リマインダー (前夜: JST 18 時以降で1回)
  //    明日 (JST) 開催のイベントが対象
  // ============================================
  if (jst.hour >= 18) {
    // JST の明日 0:00 〜 明後日 0:00 (直前) を UTC 範囲で表現
    const tomorrowStart = jstDateToUtc(jst.year, jst.month, jst.day + 1, 0);
    const tomorrowEnd = new Date(
      jstDateToUtc(jst.year, jst.month, jst.day + 2, 0).getTime() - 1
    );

    result.reminder_eve = await sendReminders(admin, {
      kind: "reminder_eve",
      prefColumn: "notify_reminder_eve",
      titlePrefix: "明日開催:",
      from: tomorrowStart,
      to: tomorrowEnd,
    });
  }

  // ============================================
  // 2) 当日リマインダー (朝: JST 7〜11 時帯で1回)
  // ============================================
  if (jst.hour >= 7 && jst.hour < 12) {
    // JST の今日 0:00 〜 明日 0:00 (直前) を UTC 範囲で表現
    const todayStart = jstDateToUtc(jst.year, jst.month, jst.day, 0);
    const todayEnd = new Date(
      jstDateToUtc(jst.year, jst.month, jst.day + 1, 0).getTime() - 1
    );

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
  // 3b) チケット販売終了通知 (締切前 3日/前日/当日 + 締切後)
  //     cron は 9 時/19 時 JST の 2 回。窓を広めにとり、重複は log で防ぐ。
  // ============================================
  result.ticket_end_3d = await sendTicketSaleEnd(
    admin,
    "ticket_end_3d",
    60,
    84,
    "まもなく販売終了 (3日前):"
  );
  result.ticket_end_1d = await sendTicketSaleEnd(
    admin,
    "ticket_end_1d",
    12,
    36,
    "明日販売終了:"
  );
  result.ticket_end_soon = await sendTicketSaleEnd(
    admin,
    "ticket_end_soon",
    0,
    6,
    "まもなく販売終了:"
  );
  result.ticket_end_over = await sendTicketSaleEnd(
    admin,
    "ticket_end_over",
    -15,
    0,
    "チケット販売が終了:"
  );

  // ============================================
  // 4) 興味マッチ新着 (週1: JST 月曜 朝 9 時台に1回)
  // ============================================
  if (jst.dow === 1 && jst.hour === 9) {
    result.interest_weekly = await sendInterestWeekly(admin);
  }

  // ============================================
  // 4a) あなた向け週次ダイジェスト (JST 土曜 朝 9 時台に1回)
  //     新着に限らず、興味タグに合う今後のイベントをまとめて通知。
  // ============================================
  if (jst.dow === 6 && jst.hour === 9) {
    result.interest_digest = await sendInterestDigest(admin);
  }

  // ============================================
  // 4b) LINE 週次一斉配信 (JST 日曜 朝 9 時台に1回)
  //     友だち全員へ「今週開催のイベント」「今週チケット販売開始」を配信。
  // ============================================
  if (jst.dow === 0 && jst.hour === 9) {
    result.line_weekly = await sendLineWeeklyBroadcast(admin);
  }

  // ============================================
  // 5) 近隣マッチ (日次: JST 朝 9 時帯に1回)
  //    home_area × 興味タグ × 過去24h の新着
  // ============================================
  if (jst.hour === 9) {
    result.nearby_match = await sendNearbyMatch(admin);
  }

  // ============================================
  // 5b) 興味タグの開催前リマインダー (日次: JST 朝 9 時帯に1回)
  //     保存していなくても、興味タグに合うイベントの開催が近づいたら通知。
  //     7日前 / 前日、花火 (festival_hanabi) だけ当日朝も。
  // ============================================
  if (jst.hour === 9) {
    const up = await sendInterestUpcoming(admin);
    result.interest_upcoming_7d = up.d7;
    result.interest_upcoming_1d = up.d1;
    result.interest_upcoming_morning = up.morning;
  }

  // ============================================
  // 5c) 興味タグのチケット発売通知 (毎回: 25時間以内に発売開始)
  //     保存不要。興味タグに合うイベントの発売開始を先回り通知。
  //     cron は 1 日 2 回 (9時/19時 JST) なので窓は広め、重複は log で防止。
  // ============================================
  result.interest_ticket_24h = await sendInterestTicket(admin);

  // ============================================
  // 6) 保存した検索の新着マッチ (毎時チェック)
  //    last_notified_at 以降に作られた、条件に合う新着イベントを通知
  // ============================================
  result.saved_search = await sendSavedSearchMatches(admin);

    await logCronRun(admin, {
      startedAt,
      ok: true,
      summary: result,
      error: null,
    });

    return NextResponse.json({ ok: true, now: now.toISOString(), result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun(admin, {
      startedAt,
      ok: false,
      summary: result,
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
      kind: "notify",
      started_at: args.startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      ok: args.ok,
      summary: args.summary,
      error: args.error ? args.error.slice(0, 2000) : null,
    });
  } catch (e) {
    console.warn("[notify:log] failed", e);
  }
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

  const rows = data as unknown as SavedEventRow[];
  // 関係するユーザーの prefs を 1 クエリでまとめて取得 (N+1 回避)
  const profiles = await fetchProfilesByIds(
    admin,
    rows.map((r) => r.user_id),
    `${opts.prefColumn}, notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end`
  );

  let sent = 0;
  for (const row of rows) {
    const ev = row.events;
    if (!ev || !row.notify_event_reminder) continue;

    // ユーザー側の prefs
    const profile = profiles.get(row.user_id);
    if (!profile || !(profile as Record<string, boolean>)[opts.prefColumn]) continue;
    if (isQuietNow(profile as unknown as QuietPrefs, new Date())) continue;

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
      timeZone: "Asia/Tokyo",
    });
    const place = [ev.area, ev.venue_name].filter(Boolean).join(" / ");

    const ok = await notifyUser(admin, row.user_id, {
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

  const rows = data as unknown as Array<
    Record<string, unknown> & {
      user_id: string;
      events: EventForTicket | null;
    }
  >;
  const profiles = await fetchProfilesByIds(
    admin,
    rows.map((r) => r.user_id),
    "notify_ticket, notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end"
  );

  let sent = 0;
  for (const row of rows) {
    const ev = row.events;
    const enabled = row[col] as boolean;
    if (!ev || !enabled || !ev.ticket_sale_starts_at) continue;

    // ユーザー側 prefs (notify_ticket) でも一括 OFF できる
    const profile = profiles.get(row.user_id) as
      | { notify_ticket?: boolean }
      | undefined;
    if (!profile?.notify_ticket) continue;
    if (isQuietNow(profile as unknown as QuietPrefs, new Date())) continue;

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

    const ok = await notifyUser(admin, row.user_id, {
      title: `${label} ${ev.title}`,
      body: new Date(ev.ticket_sale_starts_at).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
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
// チケット販売終了通知 (締切前リマインド + 締切後のお知らせ)
//   kind: ticket_end_3d / ticket_end_1d / ticket_end_soon / ticket_end_over
//   ticket_sale_ends_at が [now+fromH, now+toH] の窓に入る saved_events を対象。
//   cron は 1 日 2 回 (9 時 / 19 時 JST) なので窓は広め。notification_log で重複防止。
// =====================================================
async function sendTicketSaleEnd(
  admin: ReturnType<typeof createAdminClient>,
  kind: "ticket_end_3d" | "ticket_end_1d" | "ticket_end_soon" | "ticket_end_over",
  fromHours: number,
  toHours: number,
  label: string
) {
  const now = new Date();
  const from = new Date(now.getTime() + fromHours * 60 * 60 * 1000);
  const to = new Date(now.getTime() + toHours * 60 * 60 * 1000);

  const { data, error } = await admin
    .from("saved_events")
    .select(
      `user_id,
       events!inner ( id, title, ticket_sale_ends_at )`
    )
    .gte("events.ticket_sale_ends_at", from.toISOString())
    .lte("events.ticket_sale_ends_at", to.toISOString())
    .eq("events.approved", true);

  if (error || !data) return 0;

  const rows = data as unknown as Array<{
    user_id: string;
    events: EventForTicketEnd | null;
  }>;
  const profiles = await fetchProfilesByIds(
    admin,
    rows.map((r) => r.user_id),
    "notify_ticket, notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end"
  );

  let sent = 0;
  for (const row of rows) {
    const ev = row.events;
    if (!ev || !ev.ticket_sale_ends_at) continue;

    // ユーザー側 prefs (notify_ticket) でまとめて ON/OFF。静音時間も尊重。
    const profile = profiles.get(row.user_id) as
      | { notify_ticket?: boolean }
      | undefined;
    if (!profile?.notify_ticket) continue;
    if (isQuietNow(profile as unknown as QuietPrefs, new Date())) continue;

    // 重複防止
    const dup = await admin
      .from("notification_log")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("kind", kind)
      .eq("event_id", ev.id)
      .maybeSingle();
    if (dup.data) continue;

    const when = new Date(ev.ticket_sale_ends_at).toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });
    const body =
      kind === "ticket_end_over" ? `${when} に販売終了しました` : `締切: ${when}`;

    const ok = await notifyUser(admin, row.user_id, {
      title: `${label} ${ev.title}`,
      body,
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
// 保存履歴学習: 過去90日に保存したイベントの category 分布から重みを返す
//   重み = (そのカテゴリの保存数 / 全保存数) * 2  (最大2点程度のブースト)
// =====================================================
async function learnCategoryWeights(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<Partial<Record<EventCategory, number>>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("saved_events")
    .select("events!inner ( category )")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (!data || data.length === 0) return {};

  const counts: Partial<Record<EventCategory, number>> = {};
  let total = 0;
  for (const row of data as unknown as Array<{ events: { category: EventCategory } | null }>) {
    const cat = row.events?.category;
    if (!cat) continue;
    counts[cat] = (counts[cat] ?? 0) + 1;
    total += 1;
  }
  if (total === 0) return {};

  const weights: Partial<Record<EventCategory, number>> = {};
  for (const [cat, n] of Object.entries(counts)) {
    weights[cat as EventCategory] = ((n as number) / total) * 2;
  }
  return weights;
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
    .select(
      `id, interest_categories, notify_interest_min_score,
       notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end`
    )
    .eq("notify_interest_weekly", true)
    .not("interest_categories", "is", null);

  if (!users || users.length === 0) return 0;

  let sent = 0;
  for (const u of users as Array<
    {
      id: string;
      interest_categories: EventCategory[] | null;
      notify_interest_min_score: number | null;
    } & QuietPrefs
  >) {
    const cats = u.interest_categories ?? [];
    if (cats.length === 0) continue;
    if (isQuietNow(u, new Date())) continue;

    // 保存履歴からカテゴリ重みを学習 (過去90日に保存したイベントの category 分布)
    const catWeights = await learnCategoryWeights(admin, u.id);
    const minScore = u.notify_interest_min_score ?? 1.0;

    // 過去7日に作られた、興味カテゴリに合う、未来開催のイベント
    const { data: rawEvents } = await admin
      .from("events")
      .select("id, title, category")
      .eq("approved", true)
      .in("category", cats)
      .gte("created_at", since.toISOString())
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(20);

    if (!rawEvents || rawEvents.length === 0) continue;

    // スコア = 1 (興味カテゴリ一致の基礎点) + 保存履歴の重み。閾値で絞り、降順に。
    const scored = rawEvents
      .map((e) => ({
        ...e,
        score: 1 + (catWeights[e.category as EventCategory] ?? 0),
      }))
      .filter((e) => e.score >= minScore)
      .sort((a, b) => b.score - a.score);

    const events = scored.slice(0, 5);
    if (events.length === 0) continue;

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
    const ok = await notifyUser(admin, u.id, {
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
// あなた向け週次ダイジェスト (週1)
//   sendInterestWeekly と違い「新着」に限らず、登録日を問わず
//   興味タグに合う今後(次14日)のイベントをまとめて通知する。
//   → 新規追加が無い静かな週でも毎週必ず届くので体感の抜けを埋める。
// =====================================================
async function sendInterestDigest(
  admin: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: users } = await admin
    .from("profiles")
    .select(
      `id, interest_categories,
       notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end`
    )
    .eq("notify_interest_upcoming", true)
    .not("interest_categories", "is", null);

  const list = (users ?? []) as InterestUser[];
  if (list.length === 0) return 0;

  let sent = 0;
  for (const u of list) {
    if (isQuietNow(u, new Date())) continue;

    const set = expandInterestSet(u.interest_categories);
    if (set.size === 0) continue;

    // 今後14日・興味タグに合う開催予定を取得 (登録日は問わない)
    const { data: rawEvents } = await admin
      .from("events")
      .select("id, title, category")
      .eq("approved", true)
      .in("category", Array.from(set))
      .gte("starts_at", now.toISOString())
      .lte("starts_at", horizon.toISOString())
      .order("starts_at", { ascending: true })
      .limit(5);

    const events = (rawEvents ?? []) as Array<{
      id: string;
      title: string;
      category: EventCategory;
    }>;
    if (events.length === 0) continue;

    // 同じ週は1回まで
    const dup = await admin
      .from("notification_log")
      .select("id")
      .eq("user_id", u.id)
      .eq("kind", "interest_digest")
      .gte("sent_at", weekAgo.toISOString())
      .maybeSingle();
    if (dup.data) continue;

    const top = events[0];
    const more = events.length - 1;
    const ok = await notifyUser(admin, u.id, {
      title: `あなた向けの今後のイベント (${events.length} 件)`,
      body:
        more > 0
          ? `${CATEGORY_LABELS[top.category]} ${top.title} ほか ${more} 件`
          : `${CATEGORY_LABELS[top.category]} ${top.title}`,
      url: "/events",
      tag: "interest_digest",
    });
    if (ok > 0) {
      await admin
        .from("notification_log")
        .insert({ user_id: u.id, kind: "interest_digest", event_id: null });
      sent += 1;
    }
  }
  return sent;
}

// =====================================================
// 興味タグ展開: 親カテゴリは配下サブに展開した一致判定用セットにする
//   例: 「祭り」(festival) → festival_shrine, festival_hanabi, ... を含む
// =====================================================
function expandInterestSet(cats: string[] | null | undefined): Set<string> {
  const set = new Set<string>();
  for (const c of cats ?? []) {
    const cat = c as EventCategory;
    if (isParentCategory(cat)) {
      for (const sub of categoriesUnderParent(cat)) set.add(sub);
    } else {
      set.add(c);
    }
  }
  return set;
}

type UpcomingEvent = {
  id: string;
  title: string;
  category: EventCategory;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
};

type InterestUser = {
  id: string;
  interest_categories: string[] | null;
} & QuietPrefs;

// =====================================================
// 興味タグの開催前リマインダー (日次)
//   保存不要。興味タグに合う未来開催イベントを、開催日が近づいたら通知する。
//   - 7日後開催  → kind: interest_upcoming_7d
//   - 明日開催    → kind: interest_upcoming_1d
//   - 本日開催 (花火のみ) → kind: interest_upcoming_morning
//   重複は notification_log (user_id, kind, event_id) で防止。
// =====================================================
async function sendInterestUpcoming(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ d7: number; d1: number; morning: number }> {
  const now = new Date();
  const jst = jstParts(now);

  // 興味タグを持ち、この通知が ON のユーザーをまとめて取得
  const { data: usersData } = await admin
    .from("profiles")
    .select(
      `id, interest_categories,
       notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end`
    )
    .eq("notify_interest_upcoming", true)
    .not("interest_categories", "is", null);

  const users = (usersData ?? []) as InterestUser[];
  if (users.length === 0) return { d7: 0, d1: 0, morning: 0 };

  // 対象ユーザーごとに展開済み興味セットをキャッシュ
  const userSets = users.map((u) => ({
    user: u,
    set: expandInterestSet(u.interest_categories),
  }));

  // 指定した JST 日の 0:00〜翌0:00 直前を UTC 範囲で表現
  function jstDayRange(offsetDays: number): { from: string; to: string } {
    const from = jstDateToUtc(jst.year, jst.month, jst.day + offsetDays, 0);
    const to = new Date(
      jstDateToUtc(jst.year, jst.month, jst.day + offsetDays + 1, 0).getTime() - 1
    );
    return { from: from.toISOString(), to: to.toISOString() };
  }

  // 1つのバケツ (対象日 × kind) を処理して送信件数を返す
  async function runBucket(
    kind:
      | "interest_upcoming_7d"
      | "interest_upcoming_1d"
      | "interest_upcoming_morning",
    offsetDays: number,
    titlePrefix: string,
    hanabiOnly: boolean
  ): Promise<number> {
    const { from, to } = jstDayRange(offsetDays);
    // チケット制イベント (ticket_sale_starts_at あり) は発売タイミングで
    // sendInterestTicket が通知するため、ここでは非チケット制のみを
    // 開催タイミングで通知する (二重通知を避ける)。
    let query = admin
      .from("events")
      .select("id, title, category, starts_at, venue_name, area")
      .eq("approved", true)
      .is("ticket_sale_starts_at", null)
      .gte("starts_at", from)
      .lte("starts_at", to);
    if (hanabiOnly) query = query.eq("category", "festival_hanabi");

    const { data: eventsData } = await query;
    const events = (eventsData ?? []) as UpcomingEvent[];
    if (events.length === 0) return 0;

    let sent = 0;
    for (const { user, set } of userSets) {
      if (isQuietNow(user, new Date())) continue;
      for (const ev of events) {
        if (!set.has(ev.category)) continue;

        const dup = await admin
          .from("notification_log")
          .select("id")
          .eq("user_id", user.id)
          .eq("kind", kind)
          .eq("event_id", ev.id)
          .maybeSingle();
        if (dup.data) continue;

        const time = new Date(ev.starts_at).toLocaleString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Tokyo",
        });
        const place = [ev.area, ev.venue_name].filter(Boolean).join(" / ");

        const ok = await notifyUser(admin, user.id, {
          title: `${titlePrefix} ${ev.title}`,
          body: place ? `${time} · ${place}` : time,
          url: `/events/${ev.id}`,
          tag: `${kind}:${ev.id}`,
        });
        if (ok > 0) {
          await admin
            .from("notification_log")
            .insert({ user_id: user.id, kind, event_id: ev.id });
          sent += 1;
        }
      }
    }
    return sent;
  }

  const d7 = await runBucket(
    "interest_upcoming_7d",
    7,
    "7日後開催 (興味あり):",
    false
  );
  const d1 = await runBucket(
    "interest_upcoming_1d",
    1,
    "明日開催 (興味あり):",
    false
  );
  const morning = await runBucket(
    "interest_upcoming_morning",
    0,
    "本日開催 (花火):",
    true
  );

  return { d7, d1, morning };
}

// =====================================================
// 興味タグのチケット発売通知 (発売開始が25時間以内)
//   保存不要。興味タグに合うイベントのチケット発売開始を先回り通知。
//   cron は 1 日 2 回 (最大14h間隔) なので、窓は [now, now+25h] と広めにとり、
//   重複は notification_log (user_id, interest_ticket_24h, event_id) で防止。
// =====================================================
async function sendInterestTicket(
  admin: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // 発売開始がこの窓に入る承認済イベント (先に小さく絞る)
  const { data: eventsData } = await admin
    .from("events")
    .select("id, title, category, ticket_sale_starts_at")
    .eq("approved", true)
    .gte("ticket_sale_starts_at", from.toISOString())
    .lte("ticket_sale_starts_at", to.toISOString());

  const events = (eventsData ?? []) as Array<{
    id: string;
    title: string;
    category: EventCategory;
    ticket_sale_starts_at: string | null;
  }>;
  if (events.length === 0) return 0;

  // 興味タグを持ち、この通知が ON のユーザー
  const { data: usersData } = await admin
    .from("profiles")
    .select(
      `id, interest_categories,
       notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end`
    )
    .eq("notify_interest_ticket", true)
    .not("interest_categories", "is", null);

  const users = (usersData ?? []) as InterestUser[];
  if (users.length === 0) return 0;

  let sent = 0;
  for (const u of users) {
    if (isQuietNow(u, new Date())) continue;
    const set = expandInterestSet(u.interest_categories);

    for (const ev of events) {
      if (!ev.ticket_sale_starts_at || !set.has(ev.category)) continue;

      const dup = await admin
        .from("notification_log")
        .select("id")
        .eq("user_id", u.id)
        .eq("kind", "interest_ticket_24h")
        .eq("event_id", ev.id)
        .maybeSingle();
      if (dup.data) continue;

      const ok = await notifyUser(admin, u.id, {
        title: `明日チケット発売 (興味あり): ${ev.title}`,
        body: new Date(ev.ticket_sale_starts_at).toLocaleString("ja-JP", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Tokyo",
        }),
        url: `/events/${ev.id}`,
        tag: `interest_ticket_24h:${ev.id}`,
      });
      if (ok > 0) {
        await admin.from("notification_log").insert({
          user_id: u.id,
          kind: "interest_ticket_24h",
          event_id: ev.id,
        });
        sent += 1;
      }
    }
  }
  return sent;
}

// =====================================================
// LINE 週次一斉配信 (日曜 9 時)
//   友だち全員へ broadcast。
//   ・非チケット制で今週開催 → 「今週開催のイベント」
//   ・チケット制で今週発売開始 → 「今週チケット販売開始」
// =====================================================
async function sendLineWeeklyBroadcast(
  admin: ReturnType<typeof createAdminClient>
): Promise<number> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return 0;

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://cue-taupe-eight.vercel.app";
  const now = new Date();
  const jst = jstParts(now);
  // 今週 = 配信当日 (日曜) 0:00 JST 〜 翌週日曜 0:00 JST の直前
  const weekStart = jstDateToUtc(jst.year, jst.month, jst.day, 0);
  const weekEnd = new Date(
    jstDateToUtc(jst.year, jst.month, jst.day + 7, 0).getTime() - 1
  );
  const startIso = weekStart.toISOString();
  const endIso = weekEnd.toISOString();

  type Row = {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    is_permanent: boolean | null;
    area: string | null;
    venue_name: string | null;
    ticket_sale_starts_at: string | null;
  };

  // 非チケット制で今週開催
  const { data: openData } = await admin
    .from("events")
    .select(
      "id, title, starts_at, ends_at, is_permanent, area, venue_name, ticket_sale_starts_at"
    )
    .eq("approved", true)
    .is("ticket_sale_starts_at", null)
    .gte("starts_at", startIso)
    .lte("starts_at", endIso)
    .order("starts_at", { ascending: true })
    .limit(8);

  // チケット制で今週発売開始
  const { data: ticketData } = await admin
    .from("events")
    .select(
      "id, title, starts_at, ends_at, is_permanent, area, venue_name, ticket_sale_starts_at"
    )
    .eq("approved", true)
    .gte("ticket_sale_starts_at", startIso)
    .lte("ticket_sale_starts_at", endIso)
    .order("ticket_sale_starts_at", { ascending: true })
    .limit(8);

  const openEvents = (openData ?? []) as Row[];
  const ticketEvents = (ticketData ?? []) as Row[];
  if (openEvents.length === 0 && ticketEvents.length === 0) return 0;

  function line(ev: Row): string {
    const label = eventScheduleLabel(
      ev.starts_at,
      ev.ends_at,
      ev.is_permanent ?? false
    ).text;
    const place = [ev.area, ev.venue_name].filter(Boolean).join(" / ");
    const head = place ? `${label}・${place}` : label;
    return `・${ev.title}\n  🗓️ ${head}\n  ${origin}/events/${ev.id}`;
  }

  const blocks: string[] = [];
  if (openEvents.length > 0) {
    blocks.push(
      `🎉 今週開催のイベント\n\n${openEvents.map(line).join("\n\n")}`
    );
  }
  if (ticketEvents.length > 0) {
    const lines = ticketEvents.map((ev) => {
      const sale = ev.ticket_sale_starts_at
        ? new Date(ev.ticket_sale_starts_at).toLocaleString("ja-JP", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Tokyo",
          })
        : "";
      const place = [ev.area, ev.venue_name].filter(Boolean).join(" / ");
      const meta = [sale ? `発売 ${sale}` : "", place]
        .filter(Boolean)
        .join("・");
      return `・${ev.title}\n  🎟️ ${meta}\n  ${origin}/events/${ev.id}`;
    });
    blocks.push(`🎟️ 今週チケット販売開始\n\n${lines.join("\n\n")}`);
  }

  const text = `${blocks.join("\n\n──────────\n\n")}\n\n気になるイベントは、このままトークで友だちに送って誘えます📲`;

  const ok = await broadcastLineMessage([{ type: "text", text }]);
  return ok ? 1 : 0;
}

// =====================================================
// 保存した検索の新着マッチ (毎時)
//   saved_searches の条件に合う、last_notified_at 以降に作成された新着を通知
// =====================================================
type SavedSearchRow = {
  id: string;
  user_id: string;
  label: string;
  q: string | null;
  categories: string[] | null;
  areas: string[] | null;
  free_only: boolean | null;
  evening_only: boolean | null;
  last_notified_at: string | null;
  created_at: string;
};

async function sendSavedSearchMatches(
  admin: ReturnType<typeof createAdminClient>
) {
  const { data: searches, error } = await admin
    .from("saved_searches")
    .select(
      "id, user_id, label, q, categories, areas, free_only, evening_only, last_notified_at, created_at"
    )
    .eq("notify", true);

  if (error || !searches || searches.length === 0) return 0;

  const nowIso = new Date().toISOString();
  const rows = searches as SavedSearchRow[];
  const profiles = await fetchProfilesByIds(
    admin,
    rows.map((r) => r.user_id),
    "notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end"
  );
  let sent = 0;

  for (const s of rows) {
    // 静音時間チェック
    const profile = profiles.get(s.user_id) ?? null;
    if (isQuietNow(profile as unknown as QuietPrefs, new Date())) continue;

    const since = s.last_notified_at ?? s.created_at;

    let query = admin
      .from("events")
      .select("id, title, category, area, starts_at, description")
      .eq("approved", true)
      .gt("created_at", since)
      .gte("starts_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(20);

    if (s.categories && s.categories.length > 0) {
      query = query.in("category", s.categories);
    }
    if (s.areas && s.areas.length > 0) {
      query = query.in("area", s.areas);
    }
    if (s.free_only) query = query.eq("is_free", true);
    if (s.q && s.q.trim()) {
      const safe = s.q.replace(/[%,]/g, " ");
      query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    const { data: events } = await query;
    let matches = events ?? [];

    // 夜開催フィルタは JS 側で (JST 18時以降)
    if (s.evening_only) {
      matches = matches.filter((e) => {
        const jstHour = (new Date(e.starts_at).getUTCHours() + 9) % 24;
        return jstHour >= 18;
      });
    }

    if (matches.length === 0) {
      // 新着が無くても last_notified_at は進めておく (次回の窓を狭める)
      await admin
        .from("saved_searches")
        .update({ last_notified_at: nowIso })
        .eq("id", s.id);
      continue;
    }

    const top = matches[0];
    const more = matches.length - 1;
    const params = new URLSearchParams();
    if (s.q) params.set("q", s.q);
    const ok = await notifyUser(admin, s.user_id, {
      title: `保存した検索「${s.label}」に新着 (${matches.length}件)`,
      body:
        more > 0
          ? `${CATEGORY_LABELS[top.category as EventCategory]} ${top.title} ほか ${more} 件`
          : `${CATEGORY_LABELS[top.category as EventCategory]} ${top.title}`,
      url: params.toString() ? `/search?${params.toString()}` : "/search",
      tag: `saved_search:${s.id}`,
    });
    if (ok > 0) {
      await admin
        .from("saved_searches")
        .update({ last_notified_at: nowIso })
        .eq("id", s.id);
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
      `id, interest_categories, home_area, home_radius_km, notify_nearby_match,
       notify_quiet_hours_enabled, notify_quiet_hours_start, notify_quiet_hours_end`
    )
    .eq("notify_nearby_match", true)
    .not("home_area", "is", null);

  if (error || !users || users.length === 0) return 0;

  let sent = 0;
  for (const u of users as Array<
    {
      id: string;
      interest_categories: EventCategory[] | null;
      home_area: string | null;
      home_radius_km: number | null;
    } & QuietPrefs
  >) {
    if (!u.home_area || !isAreaName(u.home_area)) continue;
    if (isQuietNow(u, new Date())) continue;

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
    const ok = await notifyUser(admin, u.id, {
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
