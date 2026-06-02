"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PARENT_CATEGORIES,
  PARENT_LABELS,
  CATEGORY_LABELS,
  type EventCategory,
  type ParentCategory,
} from "@/lib/events";
import { cn } from "@/lib/utils";
import { saveInterestList } from "./me/interests/actions";

type Props = {
  initialCategories: EventCategory[];
};

export function HomeInterestEditor({ initialCategories }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<EventCategory[]>(initialCategories);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(c: ParentCategory) {
    setSelected((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveInterestList(selected);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error ?? "保存に失敗しました");
      }
    });
  }

  function cancel() {
    setSelected(initialCategories);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4">
        <span className="text-sm font-medium">興味タグ</span>
        {initialCategories.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            未設定 — 好きなジャンルを選ぶとおすすめが変わります
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {initialCategories.map((c) => (
              <span
                key={c}
                className="rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {CATEGORY_LABELS[c]}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          編集 →
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium">
        気になるジャンルを選んでね
      </p>
      <div className="flex flex-wrap gap-2">
        {PARENT_CATEGORIES.map((c) => {
          const active = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
            >
              {PARENT_LABELS[c]}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="rounded-md border border-border px-4 py-1.5 text-sm"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
