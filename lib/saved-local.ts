// 未ログインでも「行きたい」を押せるようにするための端末ローカル保存。
//
// ログインを求めた瞬間に大半の人は離脱するので、まずは localStorage に貯めておき、
// あとでログインしたときに saved_events へまとめて移す (mergeLocalSaves)。
//
// 一覧 (/me/saved) でもそのまま描けるように、ID だけでなくカード表示に必要な
// 最小限のスナップショットを持たせている。こうすれば未ログイン時に
// イベントを引き直すための API を増やさずに済む。

import type { EventListItem } from "@/components/event-card";

export type LocalSavedEvent = EventListItem & { savedAt: string };

const KEY = "que:savedEvents";
const MAX = 300;
// 同じタブ内の他のコンポーネントにも変更を伝えるためのイベント名
const CHANGED = "que:savedEvents:changed";

export const EMPTY_SAVED: LocalSavedEvent[] = [];

// useSyncExternalStore の getSnapshot は毎回同じ参照を返す必要があるので、
// localStorage の生文字列をキーにしてパース結果をキャッシュする。
// 新しい配列を返し続けると無限再レンダリングになる。
let cachedRaw: string | null = null;
let cachedList: LocalSavedEvent[] = EMPTY_SAVED;

function read(): LocalSavedEvent[] {
  if (typeof window === "undefined") return EMPTY_SAVED;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY_SAVED;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? (parsed as LocalSavedEvent[]) : EMPTY_SAVED;
  } catch {
    cachedList = EMPTY_SAVED;
  }
  return cachedList;
}

function write(list: LocalSavedEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // quota 超過や localStorage 無効時は諦める
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function getLocalSaved(): LocalSavedEvent[] {
  return read();
}

export function getLocalSavedIds(): string[] {
  return read().map((e) => e.id);
}

export function isLocalSaved(eventId: string): boolean {
  return read().some((e) => e.id === eventId);
}

// 保存状態を切り替えて、切り替えた後の状態を返す。
export function toggleLocalSaved(event: EventListItem): boolean {
  const list = read();
  const next = list.filter((e) => e.id !== event.id);
  if (next.length === list.length) {
    next.unshift({ ...event, savedAt: new Date().toISOString() });
    write(next);
    return true;
  }
  write(next);
  return false;
}

export function clearLocalSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 消せなくても致命的ではない
  }
  window.dispatchEvent(new Event(CHANGED));
}

// useSyncExternalStore 用。同一タブは CHANGED、別タブは storage イベントで拾う。
export function subscribeLocalSaved(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}
