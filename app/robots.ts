import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// 検索エンジン向けのクロール指示。
// 公開ページはクロール許可、個人ページ・管理・API・認証系は除外する。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/me/", "/api/", "/auth/", "/login", "/gate", "/onboarding"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
