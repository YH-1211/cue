"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitContact, type ContactState } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: ContactState = { status: "idle" };

export function ContactForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitContact,
    initialState
  );

  if (state.status === "success") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm">
        <p className="text-base font-semibold">送信しました</p>
        <p className="mt-2 text-muted-foreground">
          お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご入力いただいたメールアドレスへご返信します。
        </p>
        <div className="mt-4">
          <Link href="/" className={buttonVariants({ size: "sm" })}>
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const v =
    state.status === "error"
      ? state.values
      : { name: defaultName, email: defaultEmail, category: "other", body: "" };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">お名前</Label>
        <Input
          id="name"
          name="name"
          maxLength={100}
          required
          defaultValue={v.name}
          placeholder="山田 太郎"
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          maxLength={200}
          required
          defaultValue={v.email}
          placeholder="you@example.com"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          ご返信先になります。お間違いのないようご入力ください。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">種別</Label>
        <Select
          id="category"
          name="category"
          defaultValue={v.category}
          disabled={pending}
        >
          <option value="bug">不具合の報告</option>
          <option value="request">機能のご要望</option>
          <option value="event">イベント情報について</option>
          <option value="account">アカウントについて</option>
          <option value="other">その他</option>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">お問い合わせ内容</Label>
        <Textarea
          id="body"
          name="body"
          maxLength={4000}
          rows={8}
          required
          defaultValue={v.body}
          placeholder="お問い合わせ内容をご記入ください。"
          disabled={pending}
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "送信中..." : "送信する"}
        </Button>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
