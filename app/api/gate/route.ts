import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE, gateToken, sanitizeNext } from "@/lib/gate";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 合言葉の総当たり (ブルートフォース) 対策として厳しめに制限
  const limited = await enforceRateLimit(req, {
    name: "gate",
    limit: 10,
    windowSec: 60,
  });
  if (limited) return limited;

  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = sanitizeNext(String(form.get("next") ?? "/"));
  const expected = process.env.SITE_PASSWORD;

  if (!expected || password !== expected) {
    const back = new URL("/gate", req.url);
    back.searchParams.set("error", "1");
    back.searchParams.set("next", next);
    return NextResponse.redirect(back, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(GATE_COOKIE, await gateToken(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
