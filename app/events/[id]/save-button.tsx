"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleSaveEvent } from "./actions";

export function SaveButton({
  eventId,
  saved,
  loggedIn,
}: {
  eventId: string;
  saved: boolean;
  loggedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      await toggleSaveEvent(eventId);
    });
  };

  if (!loggedIn) {
    return (
      <Button variant="outline" size="lg" onClick={onClick} disabled={pending}>
        行きたい (ログインへ)
      </Button>
    );
  }

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size="lg"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
    >
      <span
        aria-hidden
        className={
          "inline-block transition-transform duration-300 " +
          (saved ? "scale-110 text-primary" : "")
        }
      >
        {saved ? "★" : "☆"}
      </span>
      {pending ? "更新中..." : saved ? "行きたい登録済み" : "行きたい"}
    </Button>
  );
}
