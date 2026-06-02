"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { WardMap } from "@/components/ward-map";
import {
  AREA_COORDS,
  distanceKm,
  nearbyAreas,
  type AreaName,
} from "@/lib/tokyo-areas";
import {
  CATEGORY_LABELS,
  formatEventDateTime,
  PARENT_CATEGORIES,
  PARENT_LABELS,
  type EventCategory,
} from "@/lib/events";
import { fetchNearbyEvents, type NearbyEvent } from "./actions";

type Coord = { lat: number; lng: number };

const RADIUS_OPTIONS = [3, 5, 8, 10, 15];

function nearestArea(coord: Coord): AreaName {
  let best: AreaName = "千代田";
  let min = Infinity;
  for (const [area, c] of Object.entries(AREA_COORDS) as [AreaName, Coord][]) {
    const d = distanceKm(coord, c);
    if (d < min) {
      min = d;
      best = area;
    }
  }
  return best;
}

export function NearbyClient({
  counts,
  homeArea,
}: {
  counts: Record<string, number>;
  homeArea: AreaName | null;
}) {
  const [origin, setOrigin] = useState<Coord | null>(
    homeArea ? AREA_COORDS[homeArea] : null
  );
  const [userArea, setUserArea] = useState<AreaName | null>(homeArea);
  const [source, setSource] = useState<"none" | "home" | "gps">(
    homeArea ? "home" : "none"
  );
  const [radius, setRadius] = useState(8);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"distance" | "date">("distance");
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function loadFor(
    coord: Coord,
    r: number,
    cat: string,
    sortBy: "distance" | "date" = sort
  ) {
    const areas = nearbyAreas(coord, r).map((a) => a.area);
    start(async () => {
      const res = await fetchNearbyEvents(areas, cat || undefined);
      const withDist = (res.events ?? []).map((e) => ({
        e,
        km:
          e.area && e.area in AREA_COORDS
            ? distanceKm(coord, AREA_COORDS[e.area as AreaName])
            : Infinity,
      }));
      withDist.sort((a, b) =>
        sortBy === "date"
          ? a.e.starts_at.localeCompare(b.e.starts_at)
          : a.km - b.km
      );
      setEvents(withDist.map((x) => x.e));
      setLoaded(true);
    });
  }

  function onSort(s: "distance" | "date") {
    setSort(s);
    if (origin) loadFor(origin, radius, category, s);
  }

  function useGps() {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("お使いの端末では位置情報を取得できません。");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const area = nearestArea(coord);
        setOrigin(coord);
        setUserArea(area);
        setSource("gps");
        loadFor(coord, radius, category);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "位置情報が許可されませんでした。ホームエリアを使うか、設定から許可してください。"
            : "位置情報を取得できませんでした。"
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function useHome() {
    if (!homeArea) return;
    const coord = AREA_COORDS[homeArea];
    setOrigin(coord);
    setUserArea(homeArea);
    setSource("home");
    loadFor(coord, radius, category);
  }

  function onRadius(r: number) {
    setRadius(r);
    if (origin) loadFor(origin, r, category);
  }

  function onCategory(c: string) {
    setCategory(c);
    if (origin) loadFor(origin, radius, c);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 操作 */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={useGps} disabled={pending}>
            📍 現在地から探す
          </Button>
          {homeArea && (
            <Button
              size="sm"
              variant="outline"
              onClick={useHome}
              disabled={pending}
            >
              ホームエリア({homeArea})で探す
            </Button>
          )}
          {!homeArea && (
            <Link
              href="/me/notifications"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              ホームエリアを設定
            </Link>
          )}
        </div>

        {(origin || userArea) && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              基準:{" "}
              <span className="font-medium text-foreground">
                {userArea}
                {source === "gps" ? " (現在地周辺)" : "区"}
              </span>
            </span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              半径
              <Select
                value={radius}
                onChange={(e) => onRadius(Number(e.target.value))}
                className="h-8 w-auto"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}km
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              並び
              <Pill
                active={sort === "distance"}
                onClick={() => onSort("distance")}
              >
                近い順
              </Pill>
              <Pill active={sort === "date"} onClick={() => onSort("date")}>
                開催が近い順
              </Pill>
            </div>
          </div>
        )}

        {geoError && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {geoError}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          ※ 位置情報は端末内でのみ使用し、サーバーには区名だけを送信します。
        </p>
      </div>

      {/* カテゴリ絞り込み (基準が決まってから) */}
      {origin && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1.5">
            <Pill active={category === ""} onClick={() => onCategory("")}>
              すべて
            </Pill>
            {PARENT_CATEGORIES.map((p) => (
              <Pill
                key={p}
                active={category === p}
                onClick={() => onCategory(p)}
              >
                {PARENT_LABELS[p]}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* マップ */}
      <WardMap counts={counts} userArea={userArea} />

      {/* 結果 */}
      {!origin ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          「現在地から探す」を押すと、近くで開催されるイベントが表示されます。
        </p>
      ) : pending && !loaded ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          探しています…
        </p>
      ) : events.length === 0 && loaded ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          半径 {radius}km 以内に今後のイベントは見つかりませんでした。
          <br />
          半径を広げてみてください。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => {
            const km =
              e.area && e.area in AREA_COORDS && origin
                ? distanceKm(origin, AREA_COORDS[e.area as AreaName])
                : null;
            return (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
                >
                  {e.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.cover_image_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded bg-muted" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[e.category as EventCategory]}
                      </Badge>
                      {km != null && (
                        <Badge variant="outline" className="text-xs">
                          {km < 1 ? "1km以内" : `約${Math.round(km)}km`}
                        </Badge>
                      )}
                      <time className="text-xs text-muted-foreground">
                        {formatEventDateTime(e.starts_at)}
                      </time>
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold">
                      {e.title}
                    </p>
                    {(e.area || e.venue_name) && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {e.area && `${e.area} / `}
                        {e.venue_name}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
