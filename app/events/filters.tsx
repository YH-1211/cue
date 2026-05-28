"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  EVENT_CATEGORIES,
  type EventCategory,
} from "@/lib/events";
import { cn } from "@/lib/utils";

// 東京の主要エリア (tokyo-areas.ts と同じ並び)
const AREAS = [
  "千代田",
  "中央",
  "港",
  "新宿",
  "文京",
  "台東",
  "墨田",
  "江東",
  "品川",
  "目黒",
  "大田",
  "世田谷",
  "渋谷",
  "中野",
  "杉並",
  "豊島",
  "北",
  "荒川",
  "板橋",
  "練馬",
  "足立",
  "葛飾",
  "江戸川",
] as const;

const DATE_PRESETS = [
  { value: "", label: "いつでも" },
  { value: "today", label: "今日" },
  { value: "weekend", label: "今週末" },
  { value: "month", label: "今月" },
] as const;

export function EventsFilters({
  basePath = "/events",
}: {
  basePath?: string;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  // URL を真実の源として直接読む (戻る/進むに自動追随)
  const urlQ = params.get("q") ?? "";
  const date = params.get("date") ?? "";
  const category = params.get("category") ?? "";
  const areas = (params.get("areas") ?? "").split(",").filter(Boolean);

  // 検索入力のみローカル state (タイプ中の値を保持)。URL の q が変わったら入力もそれに合わせる
  const [q, setQ] = useState(urlQ);
  const [lastSyncedQ, setLastSyncedQ] = useState(urlQ);
  if (urlQ !== lastSyncedQ) {
    // ナビゲーション (戻る/進む or クリアボタン) で URL が変わった時に同期
    setQ(urlQ);
    setLastSyncedQ(urlQ);
  }

  function apply(next: {
    q?: string;
    date?: string;
    category?: string;
    areas?: string[];
  }) {
    const sp = new URLSearchParams();
    const newQ = next.q ?? q;
    const newDate = next.date ?? date;
    const newCategory = next.category ?? category;
    const newAreas = next.areas ?? areas;
    if (newQ) sp.set("q", newQ);
    if (newDate) sp.set("date", newDate);
    if (newCategory) sp.set("category", newCategory);
    if (newAreas.length > 0) sp.set("areas", newAreas.join(","));
    const qs = sp.toString();
    start(() => router.push(qs ? `${basePath}?${qs}` : basePath));
  }

  function toggleArea(name: string) {
    const next = areas.includes(name)
      ? areas.filter((a) => a !== name)
      : [...areas, name];
    apply({ areas: next });
  }

  function selectCategory(value: string) {
    apply({ category: value });
  }

  function selectDate(value: string) {
    apply({ date: value });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    apply({ q });
  }

  const hasAny = urlQ || date || category || areas.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 transition-opacity",
        pending && "opacity-60"
      )}
    >
      {/* キーワード */}
      <form onSubmit={submitSearch} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="キーワードで検索 (タイトル / 説明)"
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={pending}>
          検索
        </Button>
        {hasAny && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setQ("");
              setLastSyncedQ("");
              start(() => router.push(basePath));
            }}
          >
            クリア
          </Button>
        )}
      </form>

      {/* 日付プリセット */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map((d) => (
          <PillButton
            key={d.value}
            active={date === d.value}
            onClick={() => selectDate(d.value)}
          >
            {d.label}
          </PillButton>
        ))}
      </div>

      {/* カテゴリ (横スクロール可) */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5">
          <PillButton
            active={category === ""}
            onClick={() => selectCategory("")}
          >
            全カテゴリ
          </PillButton>
          {EVENT_CATEGORIES.map((c) => (
            <PillButton
              key={c}
              active={category === c}
              onClick={() => selectCategory(c)}
            >
              {CATEGORY_LABELS[c as EventCategory]}
            </PillButton>
          ))}
        </div>
      </div>

      {/* エリア (複数選択) */}
      <details className="rounded-lg border border-border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium select-none">
          エリアで絞り込む {areas.length > 0 && `(${areas.length})`}
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {AREAS.map((a) => (
            <PillButton
              key={a}
              active={areas.includes(a)}
              onClick={() => toggleArea(a)}
            >
              {a}
            </PillButton>
          ))}
        </div>
      </details>
    </div>
  );
}

function PillButton({
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
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
