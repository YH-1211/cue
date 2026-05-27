"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleLike } from "./actions";

type Props = {
  attendedEventId: string;
  initialLiked: boolean;
  initialCount: number;
  disabled?: boolean;
};

export function LikeButton({
  attendedEventId,
  initialLiked,
  initialCount,
  disabled,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic(
    { liked: initialLiked, count: initialCount },
    (cur: { liked: boolean; count: number }, next: { liked: boolean }) => ({
      liked: next.liked,
      count: cur.count + (next.liked ? 1 : -1),
    })
  );

  function handle() {
    if (disabled || pending) return;
    const nextLiked = !state.liked;
    startTransition(async () => {
      setOptimistic({ liked: nextLiked });
      await toggleLike(attendedEventId, state.liked);
    });
  }

  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? "いいねを取り消す" : "いいね"}
      disabled={disabled}
      onClick={handle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        "active:scale-95",
        state.liked
          ? "bg-red-500/10 text-red-500"
          : "bg-muted text-muted-foreground hover:text-foreground",
        disabled && "opacity-50"
      )}
      style={{ touchAction: "manipulation" }}
    >
      <Heart
        className={cn(
          "size-4 transition-transform",
          state.liked && "fill-current scale-110"
        )}
      />
      <span className="tabular-nums">{state.count}</span>
    </button>
  );
}
