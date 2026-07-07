import type { MetadataRoute } from "next";
import { createClient } from "@/utils/supabase/server";
import { SITE } from "@/lib/site";
import { startOfTodayJstIso } from "@/lib/datetime";

// 公開ページ + 掲載中イベントの詳細ページを列挙したサイトマップ。
// 検索エンジンがサイト構造とイベントページを効率よくインデックスできるようにする。
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 固定の公開ページ
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/events`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/calendar`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/feed`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE.url}/news`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/credits`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 掲載中(承認済み・未終了)のイベント詳細ページ
  let eventEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("id, updated_at, starts_at")
      .eq("approved", true)
      .gte("effective_end", startOfTodayJstIso())
      .order("starts_at", { ascending: true })
      .limit(1000);

    eventEntries = ((data ?? []) as {
      id: string;
      updated_at: string | null;
      starts_at: string;
    }[]).map((e) => ({
      url: `${SITE.url}/events/${e.id}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB 取得に失敗しても固定ページだけは返す
  }

  return [...staticEntries, ...eventEntries];
}
