// 外部フィード取り込みヘルパー
// - RSS / Atom: rss-parser 経由
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

  let upserted = 0;
  for (const item of items) {
    const link = item.link?.trim();
    const title = item.title?.trim();
    if (!link || !title) continue;

    // 開始日時は isoDate を優先 (Atom の updated/published, RSS の pubDate)
    const startsAtIso = item.isoDate ?? null;
    if (!startsAtIso) continue;

    const startsAt = new Date(startsAtIso);
    if (Number.isNaN(startsAt.getTime())) continue;

    // 過去90日より古い記事は無視
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    if (startsAt.getTime() < cutoff) continue;

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

    if (!error) {
      upserted += 1;
    } else {
      // 単発の失敗はログに留めて続行
      console.warn(`[ingest] upsert failed: ${src.name} / ${link}`, error.message);
    }
  }
  return upserted;
}
