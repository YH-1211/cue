import { ImageResponse } from "next/og";
import { createClient } from "@/utils/supabase/server";
import { CATEGORY_LABELS, type EventCategory } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_COLOR: Record<EventCategory, string> = {
  art: "#ec4899",
  music: "#8b5cf6",
  theater: "#f59e0b",
  festival: "#ef4444",
  food: "#22c55e",
  seasonal: "#06b6d4",
  film: "#3b82f6",
  learning: "#14b8a6",
};

function formatDateJp(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  // Use JST display
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const m = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  return `${y}.${m}.${day}`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  // attended_events を起点に、紐づく event と profile を取得
  const { data, error } = await supabase
    .from("attended_events")
    .select(
      `
        id, attended_on, rating, memo,
        profiles!attended_events_user_id_fkey ( display_name ),
        events ( title, category, area, venue_name )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("OG attended fetch error", error);
    return new Response(`fetch error: ${error.message}`, { status: 500 });
  }
  if (!data) {
    return new Response("not found", { status: 404 });
  }

  const row = data as unknown as {
    id: string;
    attended_on: string;
    rating: number | null;
    memo: string | null;
    profiles: { display_name: string | null } | null;
    events: {
      title: string;
      category: EventCategory;
      area: string | null;
      venue_name: string | null;
    } | null;
  };

  const ev = row.events;
  if (!ev) {
    return new Response("event not found", { status: 404 });
  }

  const name = row.profiles?.display_name ?? "Cue ユーザー";
  const dateLabel = formatDateJp(row.attended_on);
  const categoryLabel = CATEGORY_LABELS[ev.category];
  const accent = CATEGORY_COLOR[ev.category];
  const stars =
    row.rating != null
      ? "★".repeat(row.rating) + "☆".repeat(5 - row.rating)
      : null;
  const where = [ev.area, ev.venue_name].filter(Boolean).join(" / ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          padding: 64,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* アクセントバー */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 12,
            height: "100%",
            backgroundColor: accent,
          }}
        />

        {/* ヘッダー */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
              Cue
            </span>
            <span style={{ fontSize: 18, color: "#a3a3a3" }}>
              行きたいが、見つかる。
            </span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "6px 14px",
              borderRadius: 999,
              backgroundColor: accent,
              color: "#0a0a0a",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {categoryLabel}
          </div>
        </div>

        {/* 中央: イベントタイトル */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
            marginTop: 20,
          }}
        >
          <span style={{ fontSize: 24, color: "#a3a3a3" }}>
            行ってきた！
          </span>
          <span
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: -1.5,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {ev.title}
          </span>
          {where && (
            <span style={{ fontSize: 26, color: "#d4d4d4" }}>{where}</span>
          )}
          {stars && (
            <span style={{ fontSize: 36, color: "#fbbf24" }}>{stars}</span>
          )}
        </div>

        {/* フッター */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #262626",
            paddingTop: 20,
          }}
        >
          <span style={{ fontSize: 22, color: "#e5e5e5" }}>{name}</span>
          <span style={{ fontSize: 22, color: "#a3a3a3" }}>{dateLabel}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}
