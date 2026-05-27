// 「3 時間前」「2 日前」など相対時刻
const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

const rtf = new Intl.RelativeTimeFormat("ja-JP", { numeric: "auto" });

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  for (const [unit, sec] of units) {
    if (abs >= sec || unit === "second") {
      return rtf.format(Math.round(diffSec / sec), unit);
    }
  }
  return "";
}
