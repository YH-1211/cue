// イベント関連の共通ユーティリティ

export const EVENT_CATEGORIES = [
  "art",
  "music",
  "theater",
  "festival",
  "food",
  "seasonal",
  "film",
  "learning",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  art: "アート",
  music: "音楽",
  theater: "舞台",
  festival: "祭り",
  food: "フード",
  seasonal: "季節",
  film: "映像",
  learning: "学び",
};

export function isEventCategory(value: string): value is EventCategory {
  return (EVENT_CATEGORIES as readonly string[]).includes(value);
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Tokyo",
});

export function formatEventDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatEventDate(iso: string): string {
  return dateOnlyFormatter.format(new Date(iso));
}
