"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount, type DeleteState } from "./actions";

const initialState: DeleteState = { status: "idle" };

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, formAction, pending] = useActionState(
    deleteMyAccount,
    initialState
  );

  return (
    <section className="mt-12 rounded-lg border border-red-300 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">
        退会（アカウント削除）
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        退会すると、あなたのアカウントとプロフィール・保存した内容・コメントなどの
        データがすべて削除されます。この操作は取り消せません。
        <br />
        （※ログアウトとは違います。ログアウトはデータを消さずにサインアウトするだけです）
      </p>

      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 border-red-400 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          onClick={() => setOpen(true)}
        >
          退会手続きに進む
        </Button>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm" className="text-xs">
              確認のため <span className="font-bold">退会</span> と入力してください
            </Label>
            <Input
              id="confirm"
              name="confirm"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="退会"
              className="max-w-[200px]"
            />
          </div>

          {state.status === "error" && (
            <p className="text-xs text-red-600">{state.message}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={pending || confirm.trim() !== "退会"}
            >
              {pending ? "退会処理中..." : "アカウントを完全に削除する"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setConfirm("");
              }}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
