import type { MetadataRoute } from "next";
import { createClient } from "@/utils/supabase/server";
import { SITE } from "@/lib/site";
import { startOfTodayJstIso } from "@/lib/datetime";
import { PARENT_CATEGORIES, isEventCategory } from "@/lib/events";
import { isKnownArea, monthSlugOf, upcomingMonths } from "@/lib/landing";

// 公開ページ + 掲載中イベントの詳細ページを列挙したサイトマップ。
// 検索エンジンがサイト構造とイベントページを効率よくインデックスできるようにする。
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 固定の公開ページ
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/events`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/events/area`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE.url}/events/category`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE.url}/events/month`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE.url}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/calendar`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/feed`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE.url}/news`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/credits`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 月別ページ。中身の有無に関わらず毎月くり返し検索される導線なので常に載せる。
  const monthEntries: MetadataRoute.Sitemap = upcomingMonths(12, now).map((m) => ({
    url: `${SITE.url}/events/month/${monthSlugOf(m)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // 掲載中(承認済み・未終了)のイベント詳細ページ
  let eventEntries: MetadataRoute.Sitemap = [];
  // エリア別 / カテゴリ別ページ。中身が1件も無いページは載せない(薄いページを量産しない)。
  let areaEntries: MetadataRoute.Sitemap = [];
  let categoryEntries: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("id, updated_at, starts_at, area, category")
      .eq("approved", true)
      .gte("effective_end", startOfTodayJstIso())
      .order("starts_at", { ascending: true })
      .limit(1000);

    const rows = (data ?? []) as {
      id: string;
      updated_at: string | null;
      starts_at: string;
      area: string | null;
      category: string | null;
    }[];

    eventEntries = rows.map((e) => ({
      url: `${SITE.url}/events/${e.id}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const areas = new Set<string>();
    const categories = new Set<string>(PARENT_CATEGORIES);
    for (const r of rows) {
      // tokyo-areas.ts に無いエリア名 (多摩・松戸など) はページが 404 になるので載せない
      if (r.area && isKnownArea(r.area)) areas.add(r.area);
      if (r.category && isEventCategory(r.category)) categories.add(r.category);
    }

    areaEntries = [...areas].map((a) => ({
      url: `${SITE.url}/events/area/${encodeURIComponent(a)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    categoryEntries = [...categories].map((c) => ({
      url: `${SITE.url}/events/category/${c}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch {
    // DB 取得に失敗しても固定ページだけは返す
  }

  return [
    ...staticEntries,
    ...monthEntries,
    ...areaEntries,
    ...categoryEntries,
    ...eventEntries,
  ];
}
