"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_LABELS,
  EVENT_CATEGORIES,
  type EventCategory,
} from "@/lib/events";
import { deleteNews, updateNews } from "./actions";

export type NewsRowData = {
  id: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  category: EventCategory;
  source_name: string;
  source_url: string;
  published_at: string;
};

export function NewsRow({ news }: { news: NewsRowData }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // 入力中の値
  const [title, setTitle] = useState(news.title);
  const [summary, setSummary] = useState(news.summary ?? "");
  const [imageUrl, setImageUrl] = useState(news.image_url ?? "");
  const [category, setCategory] = useState<EventCategory>(news.category);

  function handleSave() {
    setErr(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("summary", summary);
    fd.set("image_url", imageUrl);
    fd.set("category", category);
    start(async () => {
      try {
        await updateNews(news.id, fd);
        setEditing(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function handleDelete() {
    if (!confirm(`「${news.title}」を削除します。よろしいですか?`)) return;
    setErr(null);
    start(async () => {
      try {
        await deleteNews(news.id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (!editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          {news.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={news.image_url}
              alt=""
              className="size-16 shrink-0 rounded object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{CATEGORY_LABELS[news.category]}</Badge>
              <span className="text-xs text-muted-foreground">
                {news.source_name}
              </span>
              <time className="text-xs text-muted-foreground">
                {new Date(news.published_at).toLocaleString("ja-JP")}
              </time>
            </div>
            <p className="line-clamp-2 text-sm font-semibold">{news.title}</p>
            {news.summary && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {news.summary}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            編集
          </Button>
          <a
            href={news.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            元記事を開く
          </a>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            削除
          </Button>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-foreground/30 bg-card p-4">
      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground">タイトル</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground">要約</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground">画像 URL</label>
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground">カテゴリ</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as EventCategory)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setTitle(news.title);
            setSummary(news.summary ?? "");
            setImageUrl(news.image_url ?? "");
            setCategory(news.category);
            setErr(null);
          }}
          disabled={pending}
        >
          キャンセル
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </li>
  );
}
