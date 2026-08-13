"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";

// イベント詳細用の単一地点マップ。OpenStreetMap タイル + Leaflet (API キー不要)。
// 会場の位置にマーカーを 1 つ置くだけのシンプルな表示。
export function EventLocationMap({
  lat,
  lng,
  label,
  className,
}: {
  lat: number;
  lng: number;
  label?: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#6366f1",
        fillOpacity: 1,
      }).addTo(map);
      if (label) marker.bindTooltip(label, { direction: "top" });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, label]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-56 w-full"}
      role="img"
      aria-label={label ? `${label} の地図` : "会場の地図"}
    />
  );
}
