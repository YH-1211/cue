"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { EventGrid } from "@/components/event-card";
import { buttonVariants } from "@/components/ui/button";
import { isEventExpired } from "@/lib/datetime";
import { EMPTY_SAVED, getLocalSaved, subscribeLocalSaved } from "@/lib/saved-local";

// 未ログインの人に、この端末へ保存した「行きたい」を見せる。
// ログインするとレイアウトの SavedSync がアカウントへ移すので、ここは出番が終わる。
export function LocalSavedList() {
  const saved = useSyncExternalStore(
    subscribeLocalSaved,
    getLocalSaved,
    () => EMPTY_SAVED,
  );

  const events = saved.filter(
    (e) => e.is_permanent || !isEventExpired(e.ends_at ?? e.starts_at),
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          行きたいイベント
        </h1>
        <span className="text-xs text-muted-foreground">{events.length} 件</span>
      </header>

      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          いまはこの端末だけに保存されています。ログインすると他の端末からも見られます。
        </p>
        <Link
          href="/login?next=/me/saved"
          className={buttonVariants({ size: "sm" })}
        >
          ログインして引き継ぐ
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Bookmark aria-hidden className="size-8" />}
          title="まだ「行きたい」がありません。"
        >
          <Link
            href="/events"
            className="text-foreground underline underline-offset-2"
          >
            イベント一覧
          </Link>
          から気になるものを保存できます。
        </EmptyState>
      ) : (
        <EventGrid events={events} />
      )}
    </div>
  );
}
