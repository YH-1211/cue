"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  PARENT_CATEGORIES,
  PARENT_LABELS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  isEventCategory,
  isParentCategory,
  parentOf,
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
  const sort = params.get("sort") ?? "";
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
    sort?: string;
    areas?: string[];
  }) {
    const sp = new URLSearchParams();
    const newQ = next.q ?? q;
    const newDate = next.date ?? date;
    const newCategory = next.category ?? category;
    const newSort = next.sort ?? sort;
    const newAreas = next.areas ?? areas;
    if (newQ) sp.set("q", newQ);
    if (newDate) sp.set("date", newDate);
    if (newCategory) sp.set("category", newCategory);
    if (newSort) sp.set("sort", newSort);
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

  const hasAny = urlQ || date || category || sort || areas.length > 0;

  const SORTS = [
    { value: "", label: "開催が近い順" },
    { value: "popular", label: "人気順" },
    { value: "new", label: "新着順" },
  ] as const;

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

      {/* 日付プリセット + 並び替え */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <PillButton
              key={s.value}
              active={sort === s.value}
              onClick={() => apply({ sort: s.value })}
            >
              {s.label}
            </PillButton>
          ))}
        </div>
      </div>

      {/* カテゴリ (親 → サブの2階層) */}
      {(() => {
        const active = category && isEventCategory(category) ? category : "";
        const activeParent = active ? parentOf(active) : null;
        return (
          <div className="flex flex-col gap-2">
            {/* 親カテゴリ */}
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-1.5">
                <PillButton
                  active={active === ""}
                  onClick={() => selectCategory("")}
                >
                  全カテゴリ
                </PillButton>
                {PARENT_CATEGORIES.map((p) => (
                  <PillButton
                    key={p}
                    active={activeParent === p}
                    onClick={() => selectCategory(p)}
                  >
                    {PARENT_LABELS[p]}
                  </PillButton>
                ))}
              </div>
            </div>
            {/* サブカテゴリ (親選択時のみ) */}
            {activeParent && (
              <div className="-mx-4 overflow-x-auto border-t border-border px-4 pt-2 sm:mx-0 sm:px-0">
                <div className="flex gap-1.5">
                  <PillButton
                    active={isParentCategory(active as string)}
                    onClick={() => selectCategory(activeParent)}
                  >
                    {PARENT_LABELS[activeParent]} (すべて)
                  </PillButton>
                  {SUBCATEGORIES[activeParent].map((sub) => (
                    <PillButton
                      key={sub}
                      active={active === sub}
                      onClick={() => selectCategory(sub)}
                    >
                      {SUBCATEGORY_LABELS[sub]}
                    </PillButton>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
