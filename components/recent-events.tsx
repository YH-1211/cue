"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, categoryBadgeClass } from "@/lib/events";
import { getRecentEvents, type RecentEvent } from "@/lib/recent";

// 端末ローカルに記録した「最近見たイベント」を表示する。
// localStorage を読むのでマウント後にのみ描画する（0 件なら何も出さない）。
export function RecentEvents() {
  const [events, setEvents] = useState<RecentEvent[] | null>(null);

  useEffect(() => {
    // localStorage は client のみ・hydration mismatch を避けるためマウント後に読む
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvents(getRecentEvents());
  }, []);

  if (!events || events.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        最近見たイベント
      </h2>
      <ul className="flex flex-col gap-2">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/events/${e.id}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <Badge
                variant="secondary"
                className={`shrink-0 text-xs ${categoryBadgeClass(e.category)}`}
              >
                {CATEGORY_LABELS[e.category]}
              </Badge>
              <span className="line-clamp-1 flex-1 font-medium">{e.title}</span>
              <span aria-hidden className="text-muted-foreground">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
