"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDismissable } from "@/hooks/use-dismissable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  PARENT_CATEGORIES,
  PARENT_EMOJI,
  PARENT_LABELS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  isEventCategory,
  isParentCategory,
  parentOf,
} from "@/lib/events";
import { AREAS_BY_PREFECTURE, PREFECTURES } from "@/lib/tokyo-areas";
import {
  getRecentSearches,
  pushRecentSearch,
  removeRecentSearch,
} from "@/lib/recent";
import { cn } from "@/lib/utils";

type Facets = {
  categories: Record<string, number>;
  areas: Record<string, number>;
};

const DATE_PRESETS = [
  { value: "", label: "いつでも" },
  { value: "today", label: "今日" },
  { value: "weekend", label: "今週末" },
  { value: "month", label: "今月" },
] as const;

export function EventsFilters({
  basePath = "/events",
  facets,
}: {
  basePath?: string;
  facets?: Facets;
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
  const free = params.get("free") === "1";
  const evening = params.get("evening") === "1";
  const foodStalls = params.get("food") === "1";

  // ファセット件数 (検索ページのみ渡される)
  function catCount(value: string): number | null {
    if (!facets) return null;
    if (isParentCategory(value)) {
      let sum = 0;
      for (const [k, n] of Object.entries(facets.categories)) {
        if (k === value || (isEventCategory(k) && parentOf(k) === value))
          sum += n;
      }
      return sum;
    }
    return facets.categories[value] ?? 0;
  }
  function areaCount(value: string): number | null {
    if (!facets) return null;
    return facets.areas[value] ?? 0;
  }

  // 検索ページでは現在の絞り込み条件を保存し、タブを離れたりアプリを開き直しても続きから再開できるようにする
  const search = params.toString();
  useEffect(() => {
    if (basePath !== "/search") return;
    if (search) localStorage.setItem("cue:lastSearch", search);
    else localStorage.removeItem("cue:lastSearch");
  }, [basePath, search]);

  // 検索入力のみローカル state (タイプ中の値を保持)。URL の q が変わったら入力もそれに合わせる
  const [q, setQ] = useState(urlQ);
  const [lastSyncedQ, setLastSyncedQ] = useState(urlQ);
  if (urlQ !== lastSyncedQ) {
    // ナビゲーション (戻る/進む or クリアボタン) で URL が変わった時に同期
    setQ(urlQ);
    setLastSyncedQ(urlQ);
  }

  // オートコンプリート候補
  type Suggestion = {
    id: string;
    title: string;
    starts_at: string;
    area: string | null;
  };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { containerRef: boxRef } = useDismissable(showSuggest, () =>
    setShowSuggest(false)
  );

  // 端末ローカルの検索履歴を読み込む (localStorage は client のみ・
  // hydration mismatch を避けるためマウント後に読む)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentSearches(getRecentSearches());
  }, []);

  // キーワード入力が短い間は履歴を、2文字以上でイベント候補を出す
  const showRecent = q.trim().length < 2 && recentSearches.length > 0;

  function runSearch(term: string) {
    const t = term.trim();
    if (t) {
      pushRecentSearch(t);
      setRecentSearches(getRecentSearches());
    }
    setShowSuggest(false);
    apply({ q: t });
  }

  function dropRecentSearch(term: string) {
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  }

  useEffect(() => {
    const term = q.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal }
        );
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
      } catch {
        /* abort / network: 無視 */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function apply(next: {
    q?: string;
    date?: string;
    category?: string;
    sort?: string;
    areas?: string[];
    free?: boolean;
    evening?: boolean;
    food?: boolean;
  }) {
    const sp = new URLSearchParams();
    const newQ = next.q ?? q;
    const newDate = next.date ?? date;
    const newCategory = next.category ?? category;
    const newSort = next.sort ?? sort;
    const newAreas = next.areas ?? areas;
    const newFree = next.free ?? free;
    const newEvening = next.evening ?? evening;
    const newFood = next.food ?? foodStalls;
    if (newQ) sp.set("q", newQ);
    if (newDate) sp.set("date", newDate);
    if (newCategory) sp.set("category", newCategory);
    if (newSort) sp.set("sort", newSort);
    if (newAreas.length > 0) sp.set("areas", newAreas.join(","));
    if (newFree) sp.set("free", "1");
    if (newEvening) sp.set("evening", "1");
    if (newFood) sp.set("food", "1");
    // 条件を変えたら表示件数は初期値に戻す (show は意図的に引き継がない)
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
    runSearch(q);
  }

  const hasAny =
    urlQ ||
    date ||
    category ||
    sort ||
    areas.length > 0 ||
    free ||
    evening ||
    foodStalls;

  // 「詳細な絞り込み」内で有効になっている条件の数 (カテゴリも含む)
  const detailCount =
    (category ? 1 : 0) +
    (free ? 1 : 0) +
    (evening ? 1 : 0) +
    (foodStalls ? 1 : 0) +
    areas.length;

  const SORTS = [
    { value: "", label: "開催が近い順" },
    { value: "popular", label: "人気順" },
    { value: "new", label: "新着順" },
  ] as const;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 transition-opacity",
        pending && "opacity-60"
      )}
    >
      {/* キーワード */}
      <form onSubmit={submitSearch} className="flex gap-2">
        <div ref={boxRef} className="relative flex-1">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            placeholder="キーワードで検索 (少しの言葉でもOK)"
            className="h-9"
            autoComplete="off"
          />
          {showSuggest && showRecent && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
              <li className="flex items-center justify-between px-3 pb-1 pt-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  最近の検索
                </span>
              </li>
              {recentSearches.map((term) => (
                <li key={term} className="flex items-center hover:bg-muted">
                  <button
                    type="button"
                    onClick={() => runSearch(term)}
                    className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
                  >
                    <span aria-hidden className="text-muted-foreground">
                      🕘
                    </span>
                    <span className="line-clamp-1">{term}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`「${term}」を履歴から削除`}
                    onClick={() => dropRecentSearch(term)}
                    className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showSuggest && !showRecent && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuggest(false);
                      start(() => router.push(`/events/${s.id}`));
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="line-clamp-1 font-medium">{s.title}</span>
                    {s.area && (
                      <span className="text-xs text-muted-foreground">
                        {s.area}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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

      {/* 詳細な絞り込み (カテゴリ + こだわり条件 + エリア) */}
      <details
        className="rounded-lg border border-border bg-card p-3"
        open={detailCount > 0}
      >
        <summary className="cursor-pointer text-sm font-medium select-none">
          カテゴリ・詳細な絞り込み {detailCount > 0 && `(${detailCount})`}
        </summary>

        {/* カテゴリ (縦リスト。親の行を押すと配下のサブが開く) */}
        {(() => {
          const active = category && isEventCategory(category) ? category : "";
          const activeParent = active ? parentOf(active) : null;
          // 「すべて」の件数はファセットの合計 (イベントはカテゴリを1つだけ持つ)
          const total = facets
            ? Object.values(facets.categories).reduce((a, b) => a + b, 0)
            : null;
          return (
            <div className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                カテゴリ
              </span>
              <ul className="overflow-hidden rounded-lg border border-border">
                <li>
                  <CategoryRow
                    label="すべてのカテゴリ"
                    active={active === ""}
                    count={total}
                    onClick={() => selectCategory("")}
                  />
                </li>
                {PARENT_CATEGORIES.map((p) => {
                  const expanded = activeParent === p;
                  return (
                    <li key={p} className="border-t border-border">
                      <CategoryRow
                        label={PARENT_LABELS[p]}
                        emoji={PARENT_EMOJI[p]}
                        active={expanded}
                        count={catCount(p)}
                        expanded={expanded}
                        // 親を選択中にもう一度押したら解除、それ以外は親で絞り込む
                        onClick={() => selectCategory(active === p ? "" : p)}
                      />
                      {expanded && (
                        <ul className="border-t border-border bg-muted/30">
                          {SUBCATEGORIES[p].map((sub) => (
                            <li key={sub}>
                              <CategoryRow
                                label={SUBCATEGORY_LABELS[sub]}
                                active={active === sub}
                                count={catCount(sub)}
                                indent
                                // サブを解除したら親 (すべて) に戻す
                                onClick={() =>
                                  selectCategory(active === sub ? p : sub)
                                }
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}

        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            こだわり条件
          </span>
          <div className="flex flex-wrap gap-1.5">
            <PillButton active={free} onClick={() => apply({ free: !free })}>
              無料
            </PillButton>
            <PillButton
              active={evening}
              onClick={() => apply({ evening: !evening })}
            >
              夜開催 (18時〜)
            </PillButton>
            <PillButton
              active={foodStalls}
              onClick={() => apply({ food: !foodStalls })}
            >
              屋台あり
            </PillButton>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            エリア {areas.length > 0 && `(${areas.length})`}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-3">
          {PREFECTURES.map((pref) => (
            <div key={pref} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {pref}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(AREAS_BY_PREFECTURE[pref]).map((a) => (
                  <PillButton
                    key={a}
                    active={areas.includes(a)}
                    onClick={() => toggleArea(a)}
                    count={areaCount(a)}
                  >
                    {a}
                  </PillButton>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// カテゴリの1行。親行は絵文字と開閉マーク付き、サブ行は字下げして表示する。
function CategoryRow({
  label,
  emoji,
  count,
  active,
  expanded,
  indent,
  onClick,
}: {
  label: string;
  emoji?: string;
  count?: number | null;
  active: boolean;
  expanded?: boolean;
  indent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-expanded={expanded}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
        indent && "pl-10",
        active
          ? "bg-primary/10 font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {emoji && (
        <span aria-hidden className="w-5 shrink-0 text-center">
          {emoji}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
      {typeof expanded === "boolean" && (
        <span
          aria-hidden
          className={cn(
            "shrink-0 text-xs text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        >
          ›
        </span>
      )}
    </button>
  );
}

function PillButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number | null;
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
      {typeof count === "number" && (
        <span
          className={cn(
            "ml-1 tabular-nums",
            active ? "text-background/70" : "text-muted-foreground/60"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
