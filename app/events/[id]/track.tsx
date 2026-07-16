"use client";

import { useEffect } from "react";

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

// 詳細ページ表示で view を1回記録する（同一タブ内の再表示は送らない）
export function TrackView({ eventId }: { eventId: string }) {
  useEffect(() => {
    const key = `cue_viewed:${eventId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    send(eventId, "view");
  }, [eventId]);
  return null;
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
