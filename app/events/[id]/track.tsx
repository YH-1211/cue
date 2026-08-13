"use client";

import { useEffect } from "react";
import { pushRecentEvent } from "@/lib/recent";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventCategory } from "@/lib/events";

type Kind = "view" | "official_click" | "ticket_click" | "share";

// 計測ビーコンを送る（失敗してもユーザー体験に影響させない）
function send(eventId: string, kind: Kind) {
  const payload = JSON.stringify({ eventId, kind });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
      return;
    }
  } catch {
    // sendBeacon 不可なら fetch にフォールバック
  }
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

// 詳細ページ表示で view を1回記録する（同一タブ内の再表示は送らない）。
// あわせて端末ローカルの「最近見たイベント」にも積む（毎回更新して先頭に）。
export function TrackView({
  eventId,
  title,
  category,
}: {
  eventId: string;
  title: string;
  category: EventCategory;
}) {
  useEffect(() => {
    pushRecentEvent({ id: eventId, title, category });
    const key = `cue_viewed:${eventId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    send(eventId, "view");
  }, [eventId, title, category]);
  return null;
}

// LINE でイベントを友だち/グループに共有する導線。
// LINE の共有スキーム (line.me/R/share?text=) にタイトル＋絶対URLを渡す。
// スマホの LINE アプリ / LINE デスクトップで共有シートが開く。
export function LineShareButton({
  eventId,
  title,
  url,
}: {
  eventId: string;
  title: string;
  url: string;
}) {
  const shareUrl = `https://line.me/R/share?text=${encodeURIComponent(
    `${title}\n${url}`
  )}`;
  return (
    <a
      href={shareUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => send(eventId, "share")}
      className={cn(
        buttonVariants({ size: "lg", variant: "outline" }),
        "gap-2 border-[#06C755]/40 text-[#06C755] hover:bg-[#06C755]/10 hover:text-[#06C755]"
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-5"
        fill="currentColor"
      >
        <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.02 3.58 7.39 8.42 8.03.33.07.77.22.88.5.1.26.07.66.03.92l-.14.85c-.04.26-.2 1.02.89.56 1.1-.46 5.9-3.47 8.05-5.95C21.4 13.4 22 11.85 22 10.13 22 5.64 17.52 2 12 2ZM8.28 12.66H6.29a.53.53 0 0 1-.53-.53V8.16a.53.53 0 1 1 1.06 0v3.44h1.46a.53.53 0 1 1 0 1.06Zm2.08-.53a.53.53 0 1 1-1.06 0V8.16a.53.53 0 1 1 1.06 0v3.97Zm4.78 0a.53.53 0 0 1-.36.5.55.55 0 0 1-.17.03.52.52 0 0 1-.43-.21l-2.04-2.77v2.45a.53.53 0 1 1-1.06 0V8.16a.53.53 0 0 1 .36-.5.53.53 0 0 1 .6.18l2.04 2.78V8.16a.53.53 0 1 1 1.06 0v3.97Zm3.32-2.52a.53.53 0 1 1 0 1.06h-1.46v.93h1.46a.53.53 0 1 1 0 1.06h-1.99a.53.53 0 0 1-.53-.53V8.16a.53.53 0 0 1 .53-.53h1.99a.53.53 0 1 1 0 1.06h-1.46v.92h1.46Z" />
      </svg>
      LINEで送る
    </a>
  );
}

// 公式サイト/チケットへのリンク。クリックを記録してから通常遷移する。
export function TrackedLink({
  eventId,
  kind,
  href,
  className,
  children,
}: {
  eventId: string;
  kind: "official_click" | "ticket_click";
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => send(eventId, kind)}
    >
      {children}
    </a>
  );
}
