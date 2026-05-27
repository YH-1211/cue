"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveEvent, rejectEvent } from "./actions";

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
