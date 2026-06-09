import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// 認証のコールバック先。
// - Google OAuth: ?code= を受け取りセッションに交換する。
// - メールのマジックリンク: ?token_hash=&type= を受け取り verifyOtp で検証する。
//   (token_hash 方式はサーバーで読めるクエリで届くため SSR で確実に動く)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/me";

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // 初回ログイン (オンボーディング未完了) はオンボーディングへ誘導。
  // next が明示指定されている場合はそれを優先する。
  if (!searchParams.get("next")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.onboarded_at) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
