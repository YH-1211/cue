"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { updateQuietHours, type QuietHoursSettings } from "./actions";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SCORE_OPTIONS = [
  { value: 0.5, label: "ゆるめ (幅広く)" },
  { value: 1.0, label: "標準" },
  { value: 2.0, label: "厳しめ (好みに近いものだけ)" },
];

type Props = {
  initial: QuietHoursSettings;
};

export function QuietHoursSection({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial.notify_quiet_hours_enabled);
  const [start, setStart] = useState(initial.notify_quiet_hours_start);
  const [end, setEnd] = useState(initial.notify_quiet_hours_end);
  const [score, setScore] = useState(initial.notify_interest_min_score);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "ok" | "error"; msg: string }
  >({ kind: "idle" });

  function save() {
    startTransition(async () => {
      const res = await updateQuietHours({
        notify_quiet_hours_enabled: enabled,
        notify_quiet_hours_start: start,
        notify_quiet_hours_end: end,
        notify_interest_min_score: score,
      });
      setStatus(
        res.ok
          ? { kind: "ok", msg: "保存しました" }
          : { kind: "error", msg: res.error ?? "保存失敗" }
      );
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">静音時間 & おすすめ精度</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          指定した時間帯は通知を送りません。おすすめの厳しさも調整できます。
        </p>
      </div>

      <label className="mt-5 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 accent-foreground"
        />
        <span>静音時間を有効にする</span>
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quiet_start">開始</Label>
          <Select
            id="quiet_start"
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            disabled={!enabled}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quiet_end">終了</Label>
          <Select
            id="quiet_end"
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            disabled={!enabled}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        例: 22:00 〜 07:00 の場合、夜から朝にかけて通知を控えます (日本時間)。
      </p>

      <div className="mt-5 flex flex-col gap-1.5">
        <Label htmlFor="min_score">おすすめの厳しさ (週1の興味マッチ)</Label>
        <Select
          id="min_score"
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
        >
          {SCORE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <p className="text-[10px] text-muted-foreground">
          保存したイベントのカテゴリから好みを学習して、おすすめを並べ替えます。
        </p>
      </div>

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
    </div>
  );
}
