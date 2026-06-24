"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AREAS_BY_PREFECTURE, PREFECTURES } from "@/lib/tokyo-areas";
import { updateHomeArea, type HomeAreaSettings } from "./actions";

const RADIUS_OPTIONS = [3, 5, 8, 10, 15];

type Props = {
  initial: HomeAreaSettings;
};

export function HomeAreaSection({ initial }: Props) {
  const [homeArea, setHomeArea] = useState(initial.home_area ?? "");
  const [radius, setRadius] = useState(initial.home_radius_km);
  const [enabled, setEnabled] = useState(initial.notify_nearby_match);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "ok" | "error"; msg: string }
  >({ kind: "idle" });

  function save() {
    start(async () => {
      const res = await updateHomeArea({
        home_area: homeArea || null,
        home_radius_km: radius,
        notify_nearby_match: enabled,
      });
      if (res.ok) {
        setStatus({ kind: "ok", msg: "保存しました" });
      } else {
        setStatus({ kind: "error", msg: res.error ?? "保存失敗" });
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">ホームエリア (近隣マッチ)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            設定したエリアとその周辺で開かれる、興味タグに合う新着イベントを
            <br />
            毎朝まとめてお知らせします。
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="home_area">エリア</Label>
          <Select
            id="home_area"
            value={homeArea}
            onChange={(e) => setHomeArea(e.target.value)}
          >
            <option value="">(未設定 — 通知しない)</option>
            {PREFECTURES.map((pref) => (
              <optgroup key={pref} label={pref}>
                {Object.keys(AREAS_BY_PREFECTURE[pref]).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="radius">半径</Label>
          <Select
            id="radius"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} km 以内
              </option>
            ))}
          </Select>
        </div>
      </div>

      <label className="mt-5 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 accent-foreground"
        />
        <span>近隣マッチ通知を受け取る</span>
      </label>

      <div className="mt-4 flex items-center justify-end gap-3">
        {status.kind !== "idle" && (
          <span
            className={
              "text-xs " +
              (status.kind === "error" ? "text-red-600" : "text-emerald-600")
            }
          >
            {status.msg}
          </span>
        )}
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "保存中..." : "保存"}
        </Button>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        ※ 位置情報はサーバーに送信されません (エリア名のみ)。
      </p>
    </div>
  );
}
