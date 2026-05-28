// 外部フィード取り込みヘルパー
// - RSS / Atom: rss-parser 経由
// - target_table で events / news_items に振り分け
// - 将来 JSON / iCal を追加可能

import Parser from "rss-parser";
import type { EventCategory } from "@/lib/events";
import type { createAdminClient } from "@/utils/supabase/admin";

export type IngestSource = {
  id: string;
  name: string;
  kind: "rss" | "atom" | "ical" | "json";
  url: string;
  category_default: EventCategory;
  area_default: string | null;
  enabled: boolean;
  auto_approve: boolean;
  include_pattern: string | null;
  exclude_pattern: string | null;
  target_table: "events" | "news_items";
};

type Admin = ReturnType<typeof createAdminClient>;

const USER_AGENT = "CueBot/1.0 (+https://cue-taupe-eight.vercel.app)";

export async function ingestSource(admin: Admin, src: IngestSource): Promise<number> {
  switch (src.kind) {
    case "rss":
    case "atom":
      return ingestFeed(admin, src);
    case "json":
    case "ical":
      // 将来実装。現状は no-op で 0 件扱い。
      throw new Error(`kind "${src.kind}" は未実装です`);
    default:
      throw new Error(`unknown kind: ${src.kind}`);
  }
}

async function ingestFeed(admin: Admin, src: IngestSource): Promise<number> {
  const parser = new Parser({
    timeout: 15000,
    headers: { "User-Agent": USER_AGENT },
  });

  const feed = await parser.parseURL(src.url);
  const items = feed.items ?? [];

  // フィルタ用正規表現 (大文字小文字無視)
  const includeRe = src.include_pattern ? safeRegex(src.include_pattern) : null;
  const excludeRe = src.exclude_pattern ? safeRegex(src.exclude_pattern) : null;

  let upserted = 0;
  for (const item of items) {
    const link = item.link?.trim();
    const title = item.title?.trim();
    if (!link || !title) continue;

    // キーワードフィルタ
    if (excludeRe && excludeRe.test(title)) continue;
    if (includeRe && !includeRe.test(title)) continue;

    const isoDate = item.isoDate ?? null;
    if (!isoDate) continue;

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) continue;

    // 過去90日より古いものは無視 (news 側でも 30日 purge があるが先に弾く)
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    if (date.getTime() < cutoff) continue;

    if (src.target_table === "news_items") {
      const ok = await upsertNews(admin, src, item, title, link, date);
      if (ok) upserted += 1;
    } else {
      const ok = await upsertEvent(admin, src, item, title, link, date);
      if (ok) upserted += 1;
    }
  }
  return upserted;
}

type FeedItem = Parser.Item & { content?: string };

async function upsertEvent(
  admin: Admin,
  src: IngestSource,
  item: FeedItem,
  title: string,
  link: string,
  startsAt: Date
): Promise<boolean> {
  const row = {
    title: title.slice(0, 500),
    description: (item.contentSnippet ?? "").slice(0, 2000) || null,
    starts_at: startsAt.toISOString(),
    official_url: link,
    category: src.category_default,
    area: src.area_default,
    source_type: "rss" as const,
    source_id: link,
    approved: src.auto_approve,
  };

  const { error } = await admin
    .from("events")
    .upsert(row, { onConflict: "source_type,source_id", ignoreDuplicates: false });

  if (error) {
    console.warn(`[ingest:events] upsert failed: ${src.name} / ${link}`, error.message);
    return false;
  }
  return true;
}

async function upsertNews(
  admin: Admin,
  src: IngestSource,
  item: FeedItem,
  title: string,
  link: string,
  publishedAt: Date
): Promise<boolean> {
  const row = {
    title: title.slice(0, 500),
    summary: (item.contentSnippet ?? "").slice(0, 500) || null,
    source_name: src.name.replace(/\s*\(.+\)\s*$/, ""), // "音楽ナタリー (試験)" → "音楽ナタリー"
    source_url: link,
    category: src.category_default,
    image_url: extractImage(item),
    published_at: publishedAt.toISOString(),
    source_type: "rss" as const,
    source_id: link,
  };

  const { error } = await admin
    .from("news_items")
    .upsert(row, { onConflict: "source_type,source_id", ignoreDuplicates: false });

  if (error) {
    console.warn(`[ingest:news] upsert failed: ${src.name} / ${link}`, error.message);
    return false;
  }
  return true;
}

// content / content:encoded から <img src="..."> を抜く簡易抽出
function extractImage(item: FeedItem): string | null {
  const html = item.content ?? "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

// 不正パターンが来てもクラッシュさせない
function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch (e) {
    console.warn(`[ingest] invalid regex: ${pattern}`, e);
    return null;
  }
}
