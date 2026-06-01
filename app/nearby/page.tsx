import { createClient } from "@/utils/supabase/server";
import { AREA_COORDS, type AreaName } from "@/lib/tokyo-areas";
import { NearbyClient } from "./nearby-client";

export const metadata = { title: "近くのイベント" };

function isAreaName(s: string | null | undefined): s is AreaName {
  return !!s && s in AREA_COORDS;
}

export default async function NearbyPage() {
  const supabase = await createClient();

  // マップ用: 今後の承認済みイベントを区ごとに集計
  const { data: rows } = await supabase
    .from("events")
    .select("area")
    .eq("approved", true)
    .gte("starts_at", new Date().toISOString())
    .limit(1000);

  const counts: Record<string, number> = {};
  for (const r of rows ?? []) {
    const a = (r as { area: string | null }).area;
    if (a && a in AREA_COORDS) counts[a] = (counts[a] ?? 0) + 1;
  }

  // ログインユーザーの home_area を初期値として渡す
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let homeArea: AreaName | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("home_area")
      .eq("id", user.id)
      .maybeSingle();
    if (isAreaName(profile?.home_area)) homeArea = profile.home_area;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">近くのイベント</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          現在地やホームエリアの周辺で、これから開かれるイベントを距離順に。
        </p>
      </header>
      <NearbyClient counts={counts} homeArea={homeArea} />
    </div>
  );
}
