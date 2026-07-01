import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

// 開発中の目隠しゲート。環境変数 SITE_PASSWORD が設定されている時だけ有効
// (未設定なら素通り = ローカル開発)。合言葉を入れると Cookie を発行し、以後通す。
// PWA (ホーム画面アプリ) でも確実に動くよう Basic 認証ではなく自前画面 + Cookie 方式。
async function isGateAllowed(request: NextRequest): Promise<boolean> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return true;

  const { pathname } = request.nextUrl;
  // ゲート画面自体・照合API・Cron (CRON_SECRET で別途保護) は素通り
  if (
    pathname === "/gate" ||
    pathname === "/api/gate" ||
    pathname.startsWith("/api/cron")
  ) {
    return true;
  }

  const token = request.cookies.get(GATE_COOKIE)?.value;
  if (!token) return false;
  return token === (await gateToken(password));
}

export async function proxy(request: NextRequest) {
  if (!(await isGateAllowed(request))) {
    const gate = new URL("/gate", request.url);
    gate.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(gate);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 以下を除く全てのリクエストにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     * - 画像拡張子 (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
