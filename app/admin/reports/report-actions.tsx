"use client";

import { useState, useTransition } from "react";
import { resolveReport, dismissReport, deleteReportedComment } from "./actions";

type Props = {
  reportId: string;
  commentId: string;
};

export function ReportActions({ reportId, commentId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "操作に失敗しました");
    });
  }

  function onDelete() {
    if (!window.confirm("このコメントを削除しますか？取り消せません。")) return;
    run(() => deleteReportedComment(reportId, commentId));
  }

  const btn =
    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className={`${btn} border-red-500/40 text-red-600 hover:bg-red-500/10`}
      >
        コメント削除
      </button>
      <button
        type="button"
        onClick={() => run(() => resolveReport(reportId))}
        disabled={pending}
        className={`${btn} border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10`}
      >
        対応済み
      </button>
      <button
        type="button"
        onClick={() => run(() => dismissReport(reportId))}
        disabled={pending}
        className={`${btn} border-border text-muted-foreground hover:bg-muted`}
      >
        却下
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
