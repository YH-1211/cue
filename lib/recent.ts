// 端末ローカル (localStorage) に「最近見たイベント」と「最近の検索キーワード」を
// 保存するためのユーティリティ。サーバーには送らず、その端末内でのみ完結する。

import type { EventCategory } from "@/lib/events";

export type RecentEvent = {
  id: string;
  title: string;
  category: EventCategory;
};

const EVENTS_KEY = "cue:recentEvents";
const SEARCHES_KEY = "cue:recentSearches";
const MAX_EVENTS = 12;
const MAX_SEARCHES = 8;

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota 超過や無効化時は諦める
  }
}

// --- 最近見たイベント ---

export function getRecentEvents(): RecentEvent[] {
  return readArray<RecentEvent>(EVENTS_KEY);
}

export function pushRecentEvent(event: RecentEvent) {
  const list = getRecentEvents().filter((e) => e.id !== event.id);
  list.unshift(event);
  writeArray(EVENTS_KEY, list.slice(0, MAX_EVENTS));
}

// --- 最近の検索キーワード ---

export function getRecentSearches(): string[] {
  return readArray<string>(SEARCHES_KEY);
}

export function pushRecentSearch(term: string) {
  const q = term.trim();
  if (!q) return;
  const list = getRecentSearches().filter((t) => t !== q);
  list.unshift(q);
  writeArray(SEARCHES_KEY, list.slice(0, MAX_SEARCHES));
}

export function removeRecentSearch(term: string) {
  writeArray(
    SEARCHES_KEY,
    getRecentSearches().filter((t) => t !== term)
  );
}
