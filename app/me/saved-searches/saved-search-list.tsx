"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteSavedSearch,
  toggleSavedSearchNotify,
} from "@/app/search/saved-actions";
import { CATEGORY_LABELS, isEventCategory } from "@/lib/events";

export type SavedSearch = {
  id: string;
  label: string;
  q: string | null;
  categories: string[] | null;
  areas: string[] | null;
  free_only: boolean | null;
  evening_only: boolean | null;
  notify: boolean;
  created_at: string;
};

function buildHref(s: SavedSearch): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.areas && s.areas.length > 0) p.set("areas", s.areas.join(","));
  if (s.free_only) p.set("free", "1");
  if (s.evening_only) p.set("evening", "1");
  // categories は展開済みなので先頭1件をカテゴリ表示に使う (簡易)
  if (s.categories && s.categories.length === 1) {
    p.set("category", s.categories[0]);
  }
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

function summarize(s: SavedSearch): string {
  const parts: string[] = [];
  if (s.q) parts.push(`「${s.q}」`);
  if (s.categories && s.categories.length > 0) {
    const labels = s.categories
      .filter(isEventCategory)
      .map((c) => CATEGORY_LABELS[c]);
    const uniqueParents = Array.from(new Set(labels));
    if (uniqueParents.length <= 3) parts.push(uniqueParents.join("・"));
    else parts.push(`${uniqueParents.length}カテゴリ`);
  }
  if (s.areas && s.areas.length > 0) parts.push(s.areas.join("・"));
  if (s.free_only) parts.push("無料");
  if (s.evening_only) parts.push("夜開催");
  return parts.length > 0 ? parts.join(" / ") : "すべてのイベント";
}

export function SavedSearchList({ searches }: { searches: SavedSearch[] }) {
  const [items, setItems] = useState(searches);
  const [pending, start] = useTransition();

  function onDelete(id: string) {
    if (!confirm("この保存した検索を削除しますか？")) return;
    start(async () => {
      const res = await deleteSavedSearch(id);
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
    });
  }

  function onToggle(id: string, next: boolean) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, notify: next } : x))
    );
    start(async () => {
      const res = await toggleSavedSearchNotify(id, next);
      if (!res.ok) {
        // 失敗時は元に戻す
        setItems((prev) =>
          prev.map((x) => (x.id === id ? { ...x, notify: !next } : x))
        );
      }
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((s) => (
        <li
          key={s.id}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <Link href={buildHref(s)} className="min-w-0 flex-1">
              <p className="font-semibold">{s.label}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {summarize(s)}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              disabled={pending}
              className="shrink-0 text-xs text-red-600 hover:underline"
            >
              削除
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={s.notify}
              onChange={(e) => onToggle(s.id, e.target.checked)}
              disabled={pending}
              className="size-4 accent-foreground"
            />
            新着が追加されたら通知する
          </label>
        </li>
      ))}
    </ul>
  );
}
