"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

export type MapMarker = {
  id: string;
  title: string;
  lat: number;
  lng: number;
};

// OpenStreetMap タイル + Leaflet の実地図。API キー不要。
// マーカーをタップするとイベント詳細へ遷移する。
export function EventMap({
  markers,
  origin,
  className,
}: {
  markers: MapMarker[];
  origin?: { lat: number; lng: number } | null;
  className?: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);

  // マップ初期化 (マウント時に一度だけ。leaflet はブラウザでのみ読み込む)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        center: [35.6812, 139.7671], // 東京駅
        zoom: 12,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // マーカー描画 (events / origin が変わるたびに再描画)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const m of markers) {
      const marker = L.circleMarker([m.lat, m.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#6366f1",
        fillOpacity: 0.95,
      });
      marker.bindTooltip(m.title, { direction: "top" });
      marker.on("click", () => router.push(`/events/${m.id}`));
      marker.addTo(layer);
      bounds.extend([m.lat, m.lng]);
    }

    if (origin) {
      const me = L.circleMarker([origin.lat, origin.lng], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#f59e0b",
        fillOpacity: 1,
      });
      me.bindTooltip("現在地", { direction: "top" });
      me.addTo(layer);
      bounds.extend([origin.lat, origin.lng]);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
    }
  }, [ready, markers, origin, router]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        ref={containerRef}
        className={className ?? "h-72 w-full"}
        role="img"
        aria-label="東京イベントマップ"
      />
      <div className="flex items-center justify-center gap-4 p-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-amber-500" />
          現在地
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-indigo-500" />
          イベント
        </span>
        <span>マーカーをタップで詳細へ</span>
      </div>
    </div>
  );
}
