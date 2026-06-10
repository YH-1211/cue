"use client";

import { useState, useTransition } from "react";
import {
  extractBulkUrls,
  publishBulkEvents,
  type BulkDraft,
  type PublishResult,
} from "./actions";
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

type Item =
  | { url: string; ok: true; include: boolean; draft: BulkDraft }
  | { url: string; ok: false; error: string };

export function BulkForm() {
  const [urlsText, setUrlsText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [extracting, startExtract] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onExtract() {
    setMsg(null);
    setResult(null);
    const urls = urlsText
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setMsg("URL を1行に1つずつ入力してください。");
      return;
    }
    startExtract(async () => {
      const rows = await extractBulkUrls(urls);
      setItems(
        rows.map((r) =>
          r.ok
            ? { url: r.url, ok: true as const, include: true, draft: r.draft }
            : { url: r.url, ok: false as const, error: r.error }
        )
      );
    });
  }

  function patch(idx: number, key: keyof BulkDraft, value: string) {
    setItems((prev) =>
      prev
        ? prev.map((it, i) =>
            i === idx && it.ok
              ? { ...it, draft: { ...it.draft, [key]: value } }
              : it
          )
        : prev
    );
  }

  function toggle(idx: number, include: boolean) {
    setItems((prev) =>
      prev
        ? prev.map((it, i) =>
            i === idx && it.ok ? { ...it, include } : it
          )
        : prev
    );
  }

  function onPublish() {
    if (!items) return;
    const drafts = items
      .filter((it): it is Extract<Item, { ok: true }> => it.ok && it.include)
      .map((it) => it.draft);
    if (drafts.length === 0) {
      setMsg("公開する行を選択してください。");
      return;
    }
    setMsg(null);
    startPublish(async () => {
      const res = await publishBulkEvents(drafts);
      setResult(res);
      // 公開できた行はリストから外す (エラー行は残す判断もあるが簡潔に全クリア)
      if (res.inserted > 0 && res.errors.length === 0) {
        setItems(null);
        setUrlsText("");
      }
    });
  }

  const okCount = items?.filter((it) => it.ok).length ?? 0;
  const selectedCount =
    items?.filter((it) => it.ok && it.include).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <Label htmlFor="urls">イベントURL（1行に1つ、最大20件）</Label>
        <Textarea
          id="urls"
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={"https://example.com/event1\nhttps://example.com/event2"}
          rows={6}
          disabled={extracting || publishing}
          className="mt-2 font-mono text-xs"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" onClick={onExtract} disabled={extracting || publishing}>
            {extracting ? "取得中..." : "情報を取得"}
          </Button>
          {items && (
            <span className="text-xs text-muted-foreground">
              {okCount} 件取得 / 選択 {selectedCount} 件
            </span>
          )}
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-semibold">
            {result.inserted} 件を公開しました
            {result.errors.length > 0 && ` / ${result.errors.length} 件スキップ`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-600 dark:text-red-400">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.label}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((it, idx) =>
            it.ok ? (
              <div
                key={idx}
                className={
                  "rounded-lg border p-4 " +
                  (it.include
                    ? "border-border bg-card"
                    : "border-dashed border-border bg-muted/30 opacity-60")
                }
              >
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`inc-${idx}`}
                    checked={it.include}
                    onChange={(e) => toggle(idx, e.target.checked)}
                    className="size-4"
                  />
                  <Label htmlFor={`inc-${idx}`} className="cursor-pointer text-xs text-muted-foreground">
                    公開対象にする
                  </Label>
                  {it.draft.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.draft.cover_image_url}
                      alt=""
                      className="ml-auto h-10 w-16 rounded object-cover"
                    />
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Input
                    value={it.draft.title}
                    onChange={(e) => patch(idx, "title", e.target.value)}
                    placeholder="タイトル"
                    disabled={publishing}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Select
                      value={it.draft.category}
                      onChange={(e) => patch(idx, "category", e.target.value)}
                      disabled={publishing}
                    >
                      <option value="">カテゴリ選択</option>
                      {PARENT_CATEGORIES.map((p) => (
                        <optgroup key={p} label={PARENT_LABELS[p]}>
                          <option value={p}>{PARENT_LABELS[p]} (すべて)</option>
                          {SUBCATEGORIES[p].map((s) => (
                            <option key={s} value={s}>
                              {SUBCATEGORY_LABELS[s]}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    <Input
                      type="datetime-local"
                      value={it.draft.starts_at}
                      onChange={(e) => patch(idx, "starts_at", e.target.value)}
                      disabled={publishing}
                    />
                    <Input
                      type="datetime-local"
                      value={it.draft.ends_at}
                      onChange={(e) => patch(idx, "ends_at", e.target.value)}
                      disabled={publishing}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      value={it.draft.venue_name}
                      onChange={(e) => patch(idx, "venue_name", e.target.value)}
                      placeholder="会場名"
                      disabled={publishing}
                    />
                    <Input
                      value={it.draft.area}
                      onChange={(e) => patch(idx, "area", e.target.value)}
                      placeholder="エリア (例: 台東)"
                      disabled={publishing}
                    />
                    <Select
                      value={it.draft.is_free}
                      onChange={(e) => patch(idx, "is_free", e.target.value)}
                      disabled={publishing}
                    >
                      <option value="">料金 不明</option>
                      <option value="free">無料</option>
                      <option value="paid">有料</option>
                    </Select>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.draft.official_url}
                  </p>
                </div>
              </div>
            ) : (
              <div
                key={idx}
                className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30"
              >
                <p className="font-medium text-red-700 dark:text-red-400">
                  取得失敗: {it.error}
                </p>
                <p className="mt-1 truncate text-muted-foreground">{it.url}</p>
              </div>
            )
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={onPublish}
              disabled={publishing || selectedCount === 0}
            >
              {publishing ? "公開中..." : `選択した ${selectedCount} 件を公開`}
            </Button>
            {msg && <span className="text-xs text-red-600">{msg}</span>}
          </div>
        </div>
      )}

      {msg && !items && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}
