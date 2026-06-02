"use client";

import { useActionState, useState, useTransition } from "react";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState
  );
  const [googlePending, startGoogle] = useTransition();
  const [googleError, setGoogleError] = useState<string | null>(null);

  function onGoogle() {
    setGoogleError(null);
    startGoogle(async () => {
      const res = await signInWithGoogle();
      if (res.url) {
        // 外部 (Supabase/Google) へはブラウザ遷移で飛ばす。
        // サーバー側 redirect だと Next が RSC 取得を試みて失敗するため。
        window.location.href = res.url;
      } else {
        setGoogleError(res.error ?? "ログインに失敗しました");
      }
    });
  }

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
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-2"
        onClick={onGoogle}
        disabled={googlePending}
      >
        <GoogleIcon />
        {googlePending ? "リダイレクト中..." : "Google で続行"}
      </Button>

      {googleError && (
        <p className="text-sm text-red-600 dark:text-red-400">{googleError}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        または
        <span className="h-px flex-1 bg-border" />
      </div>

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

        <Button type="submit" variant="outline" size="lg" disabled={pending}>
          {pending ? "送信中..." : "ログインリンクをメールで送る"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        パスワードは不要です。Google アカウント、またはメールに届くリンクからログインできます。
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
