"use client";

import Link from "next/link";
import { AREA_COORDS, type AreaName } from "@/lib/tokyo-areas";

// 23区の代表点(緯度経度)を SVG 座標へ正規化した簡易マップ。
// 外部タイル/API キー不要。各区を件数に応じた大きさのドットで表示する。

const VIEW_W = 320;
const VIEW_H = 280;
const PAD = 28;

// AREA_COORDS の緯度経度レンジから x/y を求める
const entries = Object.entries(AREA_COORDS) as [
  AreaName,
  { lat: number; lng: number },
][];
const lats = entries.map(([, c]) => c.lat);
const lngs = entries.map(([, c]) => c.lng);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);
const minLng = Math.min(...lngs);
const maxLng = Math.max(...lngs);

function project(coord: { lat: number; lng: number }) {
  const x =
    PAD + ((coord.lng - minLng) / (maxLng - minLng)) * (VIEW_W - PAD * 2);
  // 緯度が大きいほど北 = 上 (y 小)
  const y =
    PAD + ((maxLat - coord.lat) / (maxLat - minLat)) * (VIEW_H - PAD * 2);
  return { x, y };
}

export function WardMap({
  counts,
  userArea,
  activeArea,
  basePath = "/events",
}: {
  counts: Record<string, number>;
  userArea?: string | null;
  activeArea?: string | null;
  basePath?: string;
}) {
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-label="東京23区イベントマップ"
      >
        {entries.map(([area, coord]) => {
          const { x, y } = project(coord);
          const n = counts[area] ?? 0;
          // 件数 → 半径 (4〜16)
          const r = n === 0 ? 3 : 4 + (n / maxCount) * 12;
          const isUser = userArea === area;
          const isActive = activeArea === area;
          const fill = isActive
            ? "var(--color-foreground)"
            : n > 0
              ? "var(--color-primary, #6366f1)"
              : "var(--color-muted)";
          const opacity = n > 0 || isUser ? 1 : 0.35;
          return (
            <Link
              key={area}
              href={`${basePath}?area=${encodeURIComponent(area)}`}
              aria-label={`${area}区 ${n}件`}
            >
              <g style={{ cursor: "pointer" }} opacity={opacity}>
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={fill}
                  stroke={isUser ? "#f59e0b" : "transparent"}
                  strokeWidth={isUser ? 3 : 0}
                />
                {n > 0 && (
                  <text
                    x={x}
                    y={y + 3}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="var(--color-background)"
                  >
                    {n}
                  </text>
                )}
                <text
                  x={x}
                  y={y + r + 9}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--color-muted-foreground)"
                >
                  {area}
                </text>
              </g>
            </Link>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-amber-500 ring-2 ring-amber-500/40" />
          現在地
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-indigo-500" />
          イベントあり
        </span>
        <span>タップでそのエリアを表示</span>
      </div>
    </div>
  );
}
