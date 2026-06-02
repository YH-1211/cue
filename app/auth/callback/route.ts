import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

// マジックリンクのリダイレクト先。
// Supabase 側で発行された認可コードをセッションに交換する。
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/me";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
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
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
