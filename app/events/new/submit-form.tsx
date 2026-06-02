"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitEvent, type SubmitState } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PARENT_CATEGORIES,
  PARENT_LABELS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
} from "@/lib/events";

const initialState: SubmitState = { status: "idle" };

export function SubmitForm() {
  const [state, formAction, pending] = useActionState(
    submitEvent,
    initialState
  );

  if (state.status === "success") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm">
        <p className="text-base font-semibold">投稿ありがとうございます 🎉</p>
        <p className="mt-2 text-muted-foreground">
          管理者の承認後、イベント一覧に公開されます。
          承認されると <span className="font-medium text-foreground">+10pt</span>{" "}
          が加算されます（ポイント機能は準備中）。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/me" className={buttonVariants({ size: "sm" })}>
            マイページへ
          </Link>
          <Link
            href="/events/new"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            続けて投稿する
          </Link>
        </div>
      </div>
    );
  }

  const v = state.status === "error" ? state.values ?? {} : {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="title" label="タイトル" required>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          defaultValue={v.title ?? ""}
          placeholder="例: 隅田川花火大会 2026"
          disabled={pending}
        />
      </Field>

      <Field id="category" label="カテゴリ" required>
        <Select
          id="category"
          name="category"
          required
          defaultValue={v.category ?? ""}
          disabled={pending}
        >
          <option value="" disabled>
            選択してください
          </option>
          {PARENT_CATEGORIES.map((parent) => (
            <optgroup key={parent} label={PARENT_LABELS[parent]}>
              <option value={parent}>{PARENT_LABELS[parent]} (すべて)</option>
              {SUBCATEGORIES[parent].map((sub) => (
                <option key={sub} value={sub}>
                  {SUBCATEGORY_LABELS[sub]}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="starts_at" label="開催日時" required>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={v.starts_at ?? ""}
            disabled={pending}
          />
        </Field>
        <Field id="ends_at" label="終了日時（任意）">
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={v.ends_at ?? ""}
            disabled={pending}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="venue_name" label="会場名">
          <Input
            id="venue_name"
            name="venue_name"
            defaultValue={v.venue_name ?? ""}
            placeholder="例: 東京国際フォーラム"
            disabled={pending}
          />
        </Field>
        <Field id="area" label="エリア">
          <Input
            id="area"
            name="area"
            defaultValue={v.area ?? ""}
            placeholder="例: 千代田 / 渋谷 / 新宿"
            disabled={pending}
          />
        </Field>
      </div>

      <Field id="address" label="住所">
        <Input
          id="address"
          name="address"
          defaultValue={v.address ?? ""}
          placeholder="例: 東京都千代田区丸の内3-5-1"
          disabled={pending}
        />
      </Field>

      <Field id="official_url" label="公式URL" required>
        <Input
          id="official_url"
          name="official_url"
          type="url"
          inputMode="url"
          required
          maxLength={500}
          defaultValue={v.official_url ?? ""}
          placeholder="https://..."
          disabled={pending}
        />
      </Field>

      <Field id="cover_image_url" label="カバー画像URL（任意）">
        <Input
          id="cover_image_url"
          name="cover_image_url"
          type="url"
          inputMode="url"
          maxLength={500}
          defaultValue={v.cover_image_url ?? ""}
          placeholder="https://..."
          disabled={pending}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="ticket_sale_starts_at" label="チケット発売開始（任意）">
          <Input
            id="ticket_sale_starts_at"
            name="ticket_sale_starts_at"
            type="datetime-local"
            defaultValue={v.ticket_sale_starts_at ?? ""}
            disabled={pending}
          />
        </Field>
        <Field id="is_free" label="料金（任意）">
          <Select
            id="is_free"
            name="is_free"
            defaultValue={v.is_free ?? ""}
            disabled={pending}
          >
            <option value="">不明 / 未選択</option>
            <option value="free">無料</option>
            <option value="paid">有料</option>
          </Select>
        </Field>
      </div>

      <Field id="description" label="説明（任意）">
        <Textarea
          id="description"
          name="description"
          maxLength={4000}
          defaultValue={v.description ?? ""}
          placeholder="開催概要、見どころ、出演者など"
          disabled={pending}
          rows={6}
        />
      </Field>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "送信中..." : "投稿する"}
        </Button>
        <p className="text-xs text-muted-foreground">
          投稿は管理者が確認後、イベント一覧に公開されます。
        </p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
