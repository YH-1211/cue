"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteEventFromDetail } from "./admin-actions";

export function AdminDeleteButton({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const ok = window.confirm(
      `「${title}」を削除します。この操作は取り消せません。よろしいですか？`
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteEventFromDetail(eventId);
    });
  };

  return (
    <Button
      variant="destructive"
      size="lg"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "削除中..." : "イベントを削除 (管理者)"}
    </Button>
  );
}
