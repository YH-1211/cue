import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/utils/supabase/admin";

// 匿名の計測用 Cookie（ログインとは無関係。個人特定はしない）
const SID_COOKIE = "cue_sid";
const SID_MAX_AGE = 60 * 60 * 24 * 365; // 1年

const KINDS = ["view", "official_click", "ticket_click", "share"] as const;
type Kind = (typeof KINDS)[number];

// 同一 session が同じイベントを短時間に連打しても view は1回だけ数える窓
const VIEW_DEDUPE_MINUTES = 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: { eventId?: unknown; kind?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const kind = body.kind as Kind;

  if (!UUID_RE.test(eventId) || !KINDS.includes(kind)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 匿名 session_id を用意（無ければ発行）
  const jar = await cookies();
  let sid = jar.get(SID_COOKIE)?.value;
  let setCookie = false;
  if (!sid || !UUID_RE.test(sid)) {
    sid = crypto.randomUUID();
    setCookie = true;
  }

  const admin = createAdminClient();

  // view は直近 N 分の重複を除外（リロード連打・プリフェッチ対策）
  if (kind === "view") {
    const since = new Date(
      Date.now() - VIEW_DEDUPE_MINUTES * 60 * 1000
    ).toISOString();
    const { data: recent } = await admin
      .from("event_interactions")
      .select("id")
      .eq("event_id", eventId)
      .eq("session_id", sid)
      .eq("kind", "view")
      .gte("occurred_at", since)
      .limit(1)
      .maybeSingle();
    if (recent) {
      return jsonWithSid({ ok: true, deduped: true }, sid, setCookie);
    }
  }

  const { error } = await admin
    .from("event_interactions")
    .insert({ event_id: eventId, kind, session_id: sid });

  if (error) {
    // 計測失敗はユーザー体験に影響させない（サーバーログにだけ残す）
    console.error("track insert failed:", error.message);
    return jsonWithSid({ ok: false }, sid, setCookie);
  }

  return jsonWithSid({ ok: true }, sid, setCookie);
}

function jsonWithSid(
  payload: Record<string, unknown>,
  sid: string,
  setCookie: boolean
) {
  const res = NextResponse.json(payload);
  if (setCookie) {
    res.cookies.set(SID_COOKIE, sid, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SID_MAX_AGE,
    });
  }
  return res;
}
