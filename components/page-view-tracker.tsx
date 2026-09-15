"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// 計測対象から外すパス（管理画面・認証コールバック）
const SKIP_PREFIXES = ["/admin", "/auth"];

// サイト全体のページ閲覧を記録する。
// レイアウトに一度だけ置き、ページ遷移のたびに /api/track へ送る。
// イベント詳細ページの view 計測（event_interactions）とは別枠で、
// トップ・一覧・カレンダーを含む「サイトに来た人」の数を取るためのもの。
export function PageViewTracker() {
  const pathname = usePathname();
  // 同じパスに留まっている間の再実行で二重送信しないための番人
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
    // 開発中のアクセスが本番の集計に混ざらないようにする
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const params = new URLSearchParams(window.location.search);
    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    });

    // 計測が失敗してもユーザー体験には一切影響させない
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/track", blob);
        return;
      }
    } catch {
      // sendBeacon が使えなければ fetch にフォールバック
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
