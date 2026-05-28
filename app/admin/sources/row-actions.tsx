"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteSource, runSourceNow, toggleSource } from "./actions";

export function EnableToggle({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => toggleSource(id, !enabled))}
      aria-pressed={enabled}
      className={
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
        (enabled ? "bg-emerald-500" : "bg-muted") +
        (pending ? " opacity-50" : "")
      }
      aria-label={enabled ? "無効化" : "有効化"}
    >
      <span
        className={
          "ml-0.5 size-5 rounded-full bg-white shadow transition-transform " +
          (enabled ? "translate-x-5" : "translate-x-0")
        }
      />
    </button>
  );
}

export function RunNowButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await runSourceNow(id);
          } catch (e) {
            alert(`取り込み失敗: ${e instanceof Error ? e.message : String(e)}`);
          }
        })
      }
    >
      {pending ? "実行中..." : "今すぐ実行"}
    </Button>
  );
}

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm(`"${name}" を削除します。よろしいですか?`)) return;
        start(async () => deleteSource(id));
      }}
      className="text-red-600 hover:text-red-700"
    >
      {pending ? "..." : "削除"}
    </Button>
  );
}
