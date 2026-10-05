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
  /** バッジに出すジャンル名 (表示用に整形済みの文字列) */
  categoryLabel?: string;
  /** 「10月12日(日) 18:00」などの表示用日時 */
  dateText?: string;
  /** 会場名やエリア名 */
  placeText?: string;
};

// OpenStreetMap タイル + Leaflet の実地図。API キー不要。
// マーカーをタップすると概要のポップアップが開き、そこから詳細へ遷移する。
// (誤タップでいきなり遷移してしまわないよう、1クッション置いている)
// マーカーのポップアップ本体。Leaflet は DOM 要素をそのまま受け取れるので、
// innerHTML を使わずに組み立ててエスケープ漏れを防ぐ。
function buildPopup(
  m: MapMarker,
  router: ReturnType<typeof useRouter>
): HTMLElement {
  const root = document.createElement("div");
  root.className = "flex flex-col gap-1.5";

  if (m.categoryLabel) {
    const badge = document.createElement("span");
    badge.textContent = m.categoryLabel;
    badge.className =
      "inline-block w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700";
    root.append(badge);
  }

  const title = document.createElement("p");
  title.textContent = m.title;
  title.className = "text-sm font-semibold leading-snug text-foreground";
  root.append(title);

  for (const [icon, text] of [
    ["📅", m.dateText],
    ["📍", m.placeText],
  ] as const) {
    if (!text) continue;
    const line = document.createElement("p");
    line.textContent = `${icon} ${text}`;
    line.className = "text-xs leading-snug text-muted-foreground";
    root.append(line);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "詳細を見る →";
  button.className =
    "mt-1 w-full rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85";
  button.addEventListener("click", () => router.push(`/events/${m.id}`));
  root.append(button);

  return root;
}

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
      // ポップアップの中身は DOM を組み立てる (textContent なので HTML 混入の心配なし)
      marker.bindPopup(() => buildPopup(m, router), {
        closeButton: true,
        minWidth: 200,
        maxWidth: 260,
        autoPanPadding: [24, 24],
      });
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
        aria-label="イベントマップ"
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
        <span>マーカーをタップで概要を表示</span>
      </div>
    </div>
  );
}
