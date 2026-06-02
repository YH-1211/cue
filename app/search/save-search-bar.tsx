"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSearch } from "./saved-actions";

export function SaveSearchBar({ loggedIn }: { loggedIn: boolean }) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const areas = (params.get("areas") ?? "").split(",").filter(Boolean);
  const free = params.get("free") === "1";
  const evening = params.get("evening") === "1";

  function onSave() {
    setError(null);
    start(async () => {
      const res = await saveSearch({
        label: label || q || "保存した検索",
        q,
        category,
        areas,
        free,
        evening,
      });
      if (res.ok) {
        setDone(true);
        setOpen(false);
      } else {
        setError(res.error ?? "保存に失敗しました");
      }
    });
  }

  if (!loggedIn) return null;

  if (done) {
    return (
      <p className="text-xs text-muted-foreground">
        🔖 検索条件を保存しました。
        <Link
          href="/me/saved-searches"
          className="ml-1 text-foreground underline underline-offset-2"
        >
          保存した検索を見る
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          🔖 この検索条件を保存して新着通知を受け取る
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="保存名 (例: 週末の無料ライブ)"
            className="h-9 w-56"
            maxLength={60}
          />
          <Button size="sm" onClick={onSave} disabled={pending}>
            {pending ? "保存中..." : "保存"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            キャンセル
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
