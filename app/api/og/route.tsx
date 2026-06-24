import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";

// サイト全体の既定 OGP 画像 (ホーム・検索などタイトル固有カードが無いページ用)。
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          backgroundColor: "#0a0a0f",
          color: "#fafafa",
          padding: 80,
          fontFamily: "system-ui, sans-serif",
          backgroundImage:
            "radial-gradient(circle at 85% 15%, rgba(139,92,246,0.35), transparent 45%), radial-gradient(circle at 10% 90%, rgba(236,72,153,0.25), transparent 45%)",
        }}
      >
        <span
          style={{
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          {SITE.name}
        </span>
        <span style={{ fontSize: 48, fontWeight: 700, marginTop: 24 }}>
          {SITE.tagline}
        </span>
        <span style={{ fontSize: 26, color: "#a3a3a3", marginTop: 28 }}>
          アート・音楽・舞台・祭り・季節のイベントを、まとめてチェック。
        </span>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    }
  );
}
