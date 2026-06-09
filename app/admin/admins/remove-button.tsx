"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeAdmin } from "./actions";

export function RemoveButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (confirm(`${email} の管理者権限を削除しますか？`)) {
          start(() => removeAdmin(email));
        }
      }}
    >
      {pending ? "削除中..." : "削除"}
    </Button>
  );
}
