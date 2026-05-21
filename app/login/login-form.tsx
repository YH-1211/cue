"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState
  );

  if (state.status === "success") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm">
        <p className="font-medium">📬 確認メールを送信しました</p>
        <p className="mt-2 text-muted-foreground">
          <span className="font-mono">{state.email}</span> 宛にログインリンクを送りました。
          受信トレイを確認し、リンクをクリックしてください。
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          メールが届かない場合は迷惑メールフォルダもご確認ください。
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          disabled={pending}
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "送信中..." : "ログインリンクを送る"}
      </Button>

      <p className="text-xs text-muted-foreground">
        パスワードは不要です。メールに届くリンクをクリックするだけでログインできます。
      </p>
    </form>
  );
}
