"use client";

import { useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleSaveEvent } from "./actions";
import type { EventListItem } from "@/components/event-card";
import {
  isLocalSaved,
  subscribeLocalSaved,
  toggleLocalSaved,
} from "@/lib/saved-local";

export function SaveButton({
  eventId,
  saved,
  loggedIn,
  event,
}: {
  eventId: string;
  saved: boolean;
  loggedIn: boolean;
  // 未ログイン時に localStorage へ入れるカード表示用のスナップショット
  event: EventListItem;
}) {
  const [pending, startTransition] = useTransition();

  // 未ログインの保存状態は localStorage が唯一の真実。
  // SSR 時は必ず false を返して hydration のズレを避ける。
  const localSaved = useSyncExternalStore(
    subscribeLocalSaved,
    () => isLocalSaved(eventId),
    () => false,
  );

  const isSaved = loggedIn ? saved : localSaved;

  const onClick = () => {
    if (!loggedIn) {
      toggleLocalSaved(event);
      return;
    }
    startTransition(async () => {
      await toggleSaveEvent(eventId);
    });
  };

  return (
    <Button
      variant={isSaved ? "secondary" : "outline"}
      size="lg"
      onClick={onClick}
      disabled={pending}
      aria-pressed={isSaved}
      title={
        !loggedIn && isSaved
          ? "この端末に保存しています。ログインすると他の端末からも見られます。"
          : undefined
      }
    >
      <span
        aria-hidden
        className={
          "inline-block transition-transform duration-300 " +
          (isSaved ? "scale-110 text-primary" : "")
        }
      >
        {isSaved ? "★" : "☆"}
      </span>
      {pending ? "更新中..." : isSaved ? "行きたい登録済み" : "行きたい"}
    </Button>
  );
}
