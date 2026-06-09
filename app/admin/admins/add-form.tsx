"use client";

import { useActionState } from "react";
import { addAdmin, type AddAdminState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AddAdminState = { status: "idle" };

export function AddForm() {
  const [state, formAction, pending] = useActionState(addAdmin, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="email"
          type="email"
          required
          placeholder="newadmin@example.com"
          autoComplete="off"
          disabled={pending}
          key={state.status === "success" ? state.email : "input"}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "追加中..." : "管理者に追加"}
        </Button>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {state.email} を管理者に追加しました。
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        追加したメールアドレスのユーザーは、次回ログイン時から管理者権限が有効になります。まだ登録していないメールでも事前に追加できます。
      </p>
    </form>
  );
}
