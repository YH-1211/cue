"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveEvent, rejectEvent, deleteEvent } from "./actions";

export function ApproveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => start(async () => approveEvent(id))}
    >
      {pending ? "..." : "承認"}
    </Button>
  );
}

export function RejectButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm("このイベントを削除します。よろしいですか?")) return;
        start(async () => rejectEvent(id));
      }}
    >
      {pending ? "..." : "却下"}
    </Button>
  );
}

export function DeleteButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      className="border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-600"
      onClick={() => {
        if (
          !confirm(
            `「${title}」を完全に削除します。元に戻せません。よろしいですか?`
          )
        )
          return;
        start(async () => deleteEvent(id));
      }}
    >
      {pending ? "..." : "削除"}
    </Button>
  );
}
