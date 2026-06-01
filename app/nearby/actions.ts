"use server";

import { createClient } from "@/utils/supabase/server";
import { isEventCategory, type EventCategory } from "@/lib/events";

export type NearbyEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
};

// 近隣区名のリスト(クライアントで現在地から算出済み)を受け取り、
// その区で開催される今後のイベントを返す。生の座標は受け取らない。
export async function fetchNearbyEvents(
  areas: string[],
  category?: string
): Promise<{ events: NearbyEvent[]; error?: string }> {
  const validAreas = areas.filter((a) => typeof a === "string" && a.length > 0);
  if (validAreas.length === 0) return { events: [] };

  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id, title, starts_at, venue_name, area, category, cover_image_url")
    .eq("approved", true)
    .in("area", validAreas)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(60);

  if (category && isEventCategory(category)) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) return { events: [], error: error.message };
  return { events: (data ?? []) as NearbyEvent[] };
}
