import { ImageResponse } from "next/og";
import { createClient } from "@/utils/supabase/server";
import {
  CATEGORY_LABELS,
  parentOf,
  type EventCategory,
  type ParentCategory,
} from "@/lib/events";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 色は親カテゴリー単位 (サブは親色を継承)
const CATEGORY_COLOR: Record<ParentCategory, string> = {
  art: "#ec4899",
  music: "#8b5cf6",
  theater: "#f59e0b",
  festival: "#ef4444",
  food: "#22c55e",
  seasonal: "#06b6d4",
  film: "#3b82f6",
  learning: "#14b8a6",
  sports: "#f97316",
};

function formatDateJp(iso: string): string {
  const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}.${jst.getUTCMonth() + 1}.${jst.getUTCDate()}`;
}

// イベント詳細ページの OGP 画像。カバー画像が無いイベントの既定カード。
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select("title, category, area, venue_name, starts_at, ends_at, approved")
    .eq("id", id)
    .maybeSingle();

  if (!data || !data.approved) {
    return new Response("not found", { status: 404 });
  }

  const ev = data as {
    title: string;
    category: EventCategory;
    area: string | null;
    venue_name: string | null;
    starts_at: string | null;
    ends_at: string | null;
    approved: boolean;
  };

  const accent = CATEGORY_COLOR[parentOf(ev.category)];
  const categoryLabel = CATEGORY_LABELS[ev.category];
  const where = [ev.area, ev.venue_name].filter(Boolean).join(" / ");
  const dateLabel = ev.starts_at
    ? ev.ends_at && formatDateJp(ev.ends_at) !== formatDateJp(ev.starts_at)
      ? `${formatDateJp(ev.starts_at)} – ${formatDateJp(ev.ends_at)}`
      : formatDateJp(ev.starts_at)
    : "日程調整中";

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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
              {SITE.name}
            </span>
            <span style={{ fontSize: 18, color: "#a3a3a3" }}>
              {SITE.tagline}
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
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            borderTop: "1px solid #262626",
            paddingTop: 20,
          }}
        >
          <span style={{ fontSize: 24, color: "#e5e5e5" }}>{dateLabel}</span>
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
