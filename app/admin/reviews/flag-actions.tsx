"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setFlagStatus } from "./actions";

export function FlagActions({
  id,
  status,
}: {
  id: string;
  status: "open" | "resolved" | "ignored";
}) {
  const [pending, start] = useTransition();

  if (status === "open") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => start(() => setFlagStatus(id, "resolved"))}
        >
          {pending ? "更新中..." : "対応済みにする"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => start(() => setFlagStatus(id, "ignored"))}
        >
          無視する
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => start(() => setFlagStatus(id, "open"))}
    >
      {pending ? "更新中..." : "要確認に戻す"}
    </Button>
  );
}
