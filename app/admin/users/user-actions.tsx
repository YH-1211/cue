"use client";

import { useState, useTransition } from "react";
import { warnUser, banUser, unbanUser, deleteUser } from "./actions";

type Props = {
  userId: string;
  status: "active" | "warned" | "banned";
  name: string;
};

export function UserActions({ userId, status, name }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "操作に失敗しました");
    });
  }

  function onWarn() {
    const reason = window.prompt(`「${name}」に警告する理由 (任意)`);
    if (reason === null) return;
    run(() => warnUser(userId, reason));
  }

  function onBan() {
    const reason = window.prompt(`「${name}」をブロックする理由 (任意)`);
    if (reason === null) return;
    run(() => banUser(userId, reason));
  }

  function onUnban() {
    run(() => unbanUser(userId));
  }

  function onDelete() {
    if (
      !window.confirm(
        `「${name}」のアカウントを完全に削除します。この操作は取り消せません。よろしいですか？`
      )
    )
      return;
    const reason = window.prompt("削除の理由 (任意)");
    if (reason === null) return;
    run(() => deleteUser(userId, reason));
  }

  const btn =
    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "banned" ? (
        <>
          <button
            type="button"
            onClick={onWarn}
            disabled={pending}
            className={`${btn} border-amber-500/40 text-amber-600 hover:bg-amber-500/10`}
          >
            警告
          </button>
          <button
            type="button"
            onClick={onBan}
            disabled={pending}
            className={`${btn} border-red-500/40 text-red-600 hover:bg-red-500/10`}
          >
            ブロック
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onUnban}
          disabled={pending}
          className={`${btn} border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10`}
        >
          ブロック解除
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className={`${btn} border-border text-muted-foreground hover:bg-muted`}
      >
        削除
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
