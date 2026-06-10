"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
import type { ExtractedEvent } from "@/lib/extract-event";

// 投稿アクションの共通結果型 (ユーザー投稿 submitEvent / 管理 createEventByAdmin 共用)
export type EventFormState =
  | { status: "idle" }
  | { status: "error"; message: string; values?: Record<string, string> }
  | { status: "success"; eventId: string };

// URL 取得アクションの共通結果型
export type FetchUrlResult =
  | { status: "error"; message: string }
  | { status: "success"; data: ExtractedEvent };

type Fields = {
  title: string;
  category: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  area: string;
  address: string;
  official_url: string;
  cover_image_url: string;
  ticket_sale_starts_at: string;
  is_free: string;
  description: string;
};

const EMPTY_FIELDS: Fields = {
  title: "",
  category: "",
  starts_at: "",
  ends_at: "",
  venue_name: "",
  area: "",
  address: "",
  official_url: "",
  cover_image_url: "",
  ticket_sale_starts_at: "",
  is_free: "",
  description: "",
};

export function EventForm({
  submitAction,
  fetchAction,
  submitLabel = "投稿する",
  renderSuccess,
}: {
  submitAction: (
    prev: EventFormState,
    formData: FormData
  ) => Promise<EventFormState>;
  fetchAction: (url: string) => Promise<FetchUrlResult>;
  submitLabel?: string;
  renderSuccess: (eventId: string) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    submitAction,
    { status: "idle" }
  );

  const initial: Fields =
    state.status === "error" && state.values
      ? { ...EMPTY_FIELDS, ...state.values }
      : EMPTY_FIELDS;
  const [fields, setFields] = useState<Fields>(initial);
  const set = <K extends keyof Fields>(key: K, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  const [fetchUrl, setFetchUrl] = useState("");
  const [fetching, startFetch] = useTransition();
  const [fetchMsg, setFetchMsg] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  function onFetch() {
    setFetchMsg(null);
    const url = fetchUrl.trim();
    if (!url) {
      setFetchMsg({ kind: "error", text: "URL を入力してください。" });
      return;
    }
    startFetch(async () => {
      const res = await fetchAction(url);
      if (res.status !== "success") {
        setFetchMsg({ kind: "error", text: res.message });
        return;
      }
      const d = res.data;
      setFields((f) => ({
        ...f,
        title: d.title ?? f.title,
        starts_at: d.startsAt ?? f.starts_at,
        ends_at: d.endsAt ?? f.ends_at,
        venue_name: d.venueName ?? f.venue_name,
        address: d.address ?? f.address,
        cover_image_url: d.coverImageUrl ?? f.cover_image_url,
        description: d.description ?? f.description,
        official_url: f.official_url || url,
        is_free:
          d.isFree === true
            ? "free"
            : d.isFree === false
            ? "paid"
            : f.is_free,
      }));
      const filled = [
        d.title && "タイトル",
        d.startsAt && "開催日時",
        d.venueName && "会場",
        d.coverImageUrl && "画像",
      ].filter(Boolean);
      setFetchMsg({
        kind: "ok",
        text: filled.length
          ? `取得しました（${filled.join("・")} など）。内容を確認・修正してください。`
          : "一部のみ取得できました。空欄は手入力してください。",
      });
    });
  }

  if (state.status === "success") {
    return <>{renderSuccess(state.eventId)}</>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
        <Label htmlFor="fetch_url">URL から自動入力</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          イベントの公式ページ URL を貼ると、タイトル・日時・会場・画像などを自動で読み取ります。
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            id="fetch_url"
            type="url"
            inputMode="url"
            value={fetchUrl}
            onChange={(e) => setFetchUrl(e.target.value)}
            placeholder="https://..."
            disabled={fetching || pending}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onFetch}
            disabled={fetching || pending}
            className="shrink-0"
          >
            {fetching ? "取得中..." : "情報を取得"}
          </Button>
        </div>
        {fetchMsg && (
          <p
            className={
              "mt-2 text-xs " +
              (fetchMsg.kind === "ok"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400")
            }
          >
            {fetchMsg.text}
          </p>
        )}
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <Field id="title" label="タイトル" required>
          <Input
            id="title"
            name="title"
            required
            maxLength={120}
            value={fields.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例: 隅田川花火大会 2026"
            disabled={pending}
          />
        </Field>

        <Field id="category" label="カテゴリ" required>
          <Select
            id="category"
            name="category"
            required
            value={fields.category}
            onChange={(e) => set("category", e.target.value)}
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
              value={fields.starts_at}
              onChange={(e) => set("starts_at", e.target.value)}
              disabled={pending}
            />
          </Field>
          <Field id="ends_at" label="終了日時（任意）">
            <Input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              value={fields.ends_at}
              onChange={(e) => set("ends_at", e.target.value)}
              disabled={pending}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="venue_name" label="会場名">
            <Input
              id="venue_name"
              name="venue_name"
              value={fields.venue_name}
              onChange={(e) => set("venue_name", e.target.value)}
              placeholder="例: 東京国際フォーラム"
              disabled={pending}
            />
          </Field>
          <Field id="area" label="エリア">
            <Input
              id="area"
              name="area"
              value={fields.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="例: 千代田 / 渋谷 / 新宿"
              disabled={pending}
            />
          </Field>
        </div>

        <Field id="address" label="住所">
          <Input
            id="address"
            name="address"
            value={fields.address}
            onChange={(e) => set("address", e.target.value)}
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
            value={fields.official_url}
            onChange={(e) => set("official_url", e.target.value)}
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
            value={fields.cover_image_url}
            onChange={(e) => set("cover_image_url", e.target.value)}
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
              value={fields.ticket_sale_starts_at}
              onChange={(e) => set("ticket_sale_starts_at", e.target.value)}
              disabled={pending}
            />
          </Field>
          <Field id="is_free" label="料金（任意）">
            <Select
              id="is_free"
              name="is_free"
              value={fields.is_free}
              onChange={(e) => set("is_free", e.target.value)}
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
            value={fields.description}
            onChange={(e) => set("description", e.target.value)}
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
            {pending ? "送信中..." : submitLabel}
          </Button>
        </div>
      </form>
    </div>
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
