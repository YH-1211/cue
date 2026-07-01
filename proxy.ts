import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// 開発中の目隠し用 Basic 認証。
// 環境変数 SITE_PASSWORD が設定されている時だけ有効 (未設定なら素通り = ローカル開発)。
// ユーザー名は任意、パスワードのみ照合する。
function passwordGate(request: NextRequest): NextResponse | null {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;

  // Vercel Cron はサーバー間呼び出し (CRON_SECRET で別途保護) なので除外
  if (request.nextUrl.pathname.startsWith("/api/cron")) return null;

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === password) return null;
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Cue (開発中)"' },
  });
}

export async function proxy(request: NextRequest) {
  const gate = passwordGate(request);
  if (gate) return gate;
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
