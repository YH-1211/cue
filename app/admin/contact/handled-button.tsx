"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setHandled } from "./actions";

export function HandledButton({
  id,
  handled,
}: {
  id: string;
  handled: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={handled ? "outline" : "default"}
      disabled={pending}
      onClick={() => start(() => setHandled(id, !handled))}
    >
      {pending ? "更新中..." : handled ? "未対応に戻す" : "対応済みにする"}
    </Button>
  );
}
