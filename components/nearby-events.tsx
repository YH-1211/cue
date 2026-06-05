"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventCover } from "@/components/event-cover";
import {
  CATEGORY_LABELS,
  formatEventDateTime,
  type EventCategory,
} from "@/lib/events";

type NearbyEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  area: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  has_food_stalls: boolean | null;
  distance_km: number | null;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "unsupported" }
  | { kind: "error"; message: string }
  | { kind: "ready"; events: NearbyEvent[]; radiusKm: number };

const STORAGE_KEY = "cue:nearby:lastCoords";

export function NearbyEvents() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const fetchNear = async (lat: number, lng: number) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/events/near?lat=${lat}&lng=${lng}&radius=5&limit=6`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          kind: "error",
          message: body.error ?? `取得失敗 (${res.status})`,
        });
        return;
      }
      const json = await res.json();
      setState({
        kind: "ready",
        events: json.events ?? [],
        radiusKm: json.radius_km ?? 5,
      });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "通信エラー",
      });
    }
  };

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "unsupported" });
      return;
    }
    setState({ kind: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ lat: latitude, lng: longitude, at: Date.now() })
          );
        } catch {
          // ignore
        }
        fetchNear(latitude, longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ kind: "denied" });
        } else {
          setState({
            kind: "error",
            message: err.message || "位置情報の取得に失敗",
          });
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  };

  // 直近の許可があれば自動再取得 (24h 以内)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        lat: number;
        lng: number;
        at: number;
      };
      if (Date.now() - parsed.at < 24 * 60 * 60 * 1000) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchNear(parsed.lat, parsed.lng);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            近くで開催
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            現在地から半径 5km 以内のイベントを表示
          </p>
        </div>
        {state.kind === "ready" && (
          <button
            onClick={requestLocation}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ↻ 更新
          </button>
        )}
      </div>

      {(state.kind === "idle" || state.kind === "denied") && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm">
          <p className="text-muted-foreground">
            {state.kind === "denied"
              ? "位置情報がブロックされています。ブラウザ設定から許可してください。"
              : "位置情報を許可すると、近くで開催されるイベントを表示します。"}
          </p>
          <div className="mt-3">
            <Button size="sm" onClick={requestLocation}>
              📍 近くを探す
            </Button>
          </div>
        </div>
      )}

      {state.kind === "loading" && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          現在地を取得中...
        </div>
      )}

      {state.kind === "unsupported" && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          このブラウザは位置情報に対応していません。
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50/50 p-6 text-center text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {state.message}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={requestLocation}>
              再試行
            </Button>
          </div>
        </div>
      )}

      {state.kind === "ready" && state.events.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          半径 {state.radiusKm}km 以内に予定されているイベントはありません。
        </div>
      )}

      {state.kind === "ready" && state.events.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="group block focus:outline-none"
              >
                <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <EventCover
                    coverImageUrl={event.cover_image_url}
                    category={event.category}
                    hasFoodStalls={event.has_food_stalls}
                    className="h-40 w-full"
                  />
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[event.category]}
                      </Badge>
                      <time className="text-xs text-muted-foreground">
                        {formatEventDateTime(event.starts_at)}
                      </time>
                      {event.distance_km != null && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          {event.distance_km.toFixed(1)}km
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug">
                      {event.title}
                    </h3>
                    {(event.venue_name || event.area) && (
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {event.area && `${event.area} / `}
                        {event.venue_name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
