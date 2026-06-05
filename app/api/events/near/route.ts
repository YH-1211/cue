import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { nearbyAreas, type AreaName } from "@/lib/tokyo-areas";

const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 20;
const MAX_LIMIT = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat / lng が必須です" },
      { status: 400 }
    );
  }

  const radiusKm = Math.min(
    Math.max(Number(searchParams.get("radius") ?? DEFAULT_RADIUS_KM), 1),
    MAX_RADIUS_KM
  );
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), MAX_LIMIT);

  // 半径内のエリアを近い順に
  const areas = nearbyAreas({ lat, lng }, radiusKm);
  if (areas.length === 0) {
    return NextResponse.json({ areas: [], events: [] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, venue_name, area, category, cover_image_url, has_food_stalls"
    )
    .eq("approved", true)
    .in(
      "area",
      areas.map((a) => a.area)
    )
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // エリア距離マップで近さ付与してソート (starts_at 同点で近い順)
  const kmByArea = new Map<AreaName, number>(
    areas.map((a) => [a.area, a.km])
  );
  const events = (data ?? []).map((e) => ({
    ...e,
    distance_km: e.area
      ? kmByArea.get(e.area as AreaName) ?? null
      : null,
  }));

  return NextResponse.json({
    areas,
    events,
    radius_km: radiusKm,
    origin: { lat, lng },
  });
}
