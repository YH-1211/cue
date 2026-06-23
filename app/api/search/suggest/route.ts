import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { startOfTodayJstIso } from "@/lib/datetime";

// 検索オートコンプリート: 入力中のキーワードに前方/部分一致するイベント名を返す
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const supabase = await createClient();
  // trigram で並べたいが、ここでは部分一致 + 開催が近い順で十分軽量
  const safe = q.replace(/[%,]/g, " ");
  const { data, error } = await supabase
    .from("events")
    .select("id, title, starts_at, area")
    .eq("approved", true)
    .gte("starts_at", startOfTodayJstIso())
    .ilike("title", `%${safe}%`)
    .order("starts_at", { ascending: true })
    .limit(8);

  if (error) {
    return NextResponse.json({ suggestions: [] });
  }

  return NextResponse.json({ suggestions: data ?? [] });
}
