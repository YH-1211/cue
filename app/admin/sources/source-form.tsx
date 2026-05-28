"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EVENT_CATEGORIES, CATEGORY_LABELS } from "@/lib/events";

export type SourceFormDefaults = {
  name?: string;
  kind?: "rss" | "atom" | "ical" | "json";
  url?: string;
  category_default?: string;
  area_default?: string | null;
  target_table?: "events" | "news_items";
  enabled?: boolean;
  auto_approve?: boolean;
  include_pattern?: string | null;
  exclude_pattern?: string | null;
};

export function SourceForm({
  defaults,
  action,
  submitLabel,
}: {
  defaults?: SourceFormDefaults;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      action={(formData) => start(async () => action(formData))}
      className="flex flex-col gap-5"
    >
      <Field label="名前 (例: 音楽ナタリー)" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
          placeholder="表示名"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="形式" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={defaults?.kind ?? "rss"}>
            <option value="rss">RSS</option>
            <option value="atom">Atom</option>
            <option value="ical">iCal (未実装)</option>
            <option value="json">JSON (未実装)</option>
          </Select>
        </Field>

        <Field label="保存先テーブル" htmlFor="target_table">
          <Select
            id="target_table"
            name="target_table"
            defaultValue={defaults?.target_table ?? "events"}
          >
            <option value="events">events (イベント)</option>
            <option value="news_items">news_items (ニュース)</option>
          </Select>
        </Field>
      </div>

      <Field label="URL" htmlFor="url">
        <Input
          id="url"
          name="url"
          type="url"
          required
          defaultValue={defaults?.url ?? ""}
          placeholder="https://example.com/feed.xml"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="デフォルトカテゴリ" htmlFor="category_default">
          <Select
            id="category_default"
            name="category_default"
            defaultValue={defaults?.category_default ?? "music"}
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="デフォルトエリア (任意)"
          htmlFor="area_default"
          hint="例: 東京"
        >
          <Input
            id="area_default"
            name="area_default"
            defaultValue={defaults?.area_default ?? ""}
          />
        </Field>
      </div>

      <Field
        label="include パターン (正規表現・任意)"
        htmlFor="include_pattern"
        hint="タイトルがマッチするもののみ取り込み。大文字小文字無視。"
      >
        <Input
          id="include_pattern"
          name="include_pattern"
          defaultValue={defaults?.include_pattern ?? ""}
          placeholder="(ライブ|公演|フェス)"
        />
      </Field>

      <Field
        label="exclude パターン (正規表現・任意)"
        htmlFor="exclude_pattern"
        hint="タイトルがマッチするものを除外。"
      >
        <Input
          id="exclude_pattern"
          name="exclude_pattern"
          defaultValue={defaults?.exclude_pattern ?? ""}
          placeholder="(リリース|新譜|MV)"
        />
      </Field>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={defaults?.enabled ?? true}
            className="size-4 accent-foreground"
          />
          <span className="font-medium">取り込みを有効にする</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="auto_approve"
            defaultChecked={defaults?.auto_approve ?? false}
            className="mt-0.5 size-4 accent-foreground"
          />
          <span>
            <span className="font-medium">自動承認する</span>
            <span className="ml-2 text-xs text-muted-foreground">
              (events のみ。news_items は影響なし)
            </span>
          </span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.back()}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
