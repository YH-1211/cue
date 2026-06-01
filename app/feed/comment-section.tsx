"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/relative-time";
import {
  addComment,
  deleteComment,
  fetchComments,
  type FeedComment,
} from "./actions";

type Props = {
  attendedEventId: string;
  initialCount: number;
  viewerId: string | null;
};

export function CommentSection({
  attendedEventId,
  initialCount,
  viewerId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      const res = await fetchComments(attendedEventId);
      if (res.ok && res.comments) {
        setComments(res.comments);
        setCount(res.comments.length);
      }
      setLoaded(true);
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const text = body.trim();
    if (text.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await addComment(attendedEventId, text);
      if (res.ok && res.comment) {
        setComments((cur) => [...cur, res.comment!]);
        setCount((c) => c + 1);
        setBody("");
      } else {
        setError(res.error ?? "送信に失敗しました");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteComment(id);
      if (res.ok) {
        setComments((cur) => cur.filter((c) => c.id !== id));
        setCount((c) => Math.max(0, c - 1));
      }
    });
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          "active:scale-95",
          open
            ? "bg-foreground/10 text-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
        style={{ touchAction: "manipulation" }}
      >
        <MessageCircle className="size-4" />
        <span className="tabular-nums">{count}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {loading && (
            <p className="text-xs text-muted-foreground">読み込み中…</p>
          )}

          {!loading && comments.length === 0 && (
            <p className="text-xs text-muted-foreground">
              まだコメントはありません。
            </p>
          )}

          {comments.map((c) => {
            const name = c.display_name ?? "ゲスト";
            const initial = name.charAt(0).toUpperCase();
            return (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar className="size-7 shrink-0">
                  {c.avatar_url && <AvatarImage src={c.avatar_url} alt="" />}
                  <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold">
                      {name}
                    </span>
                    <time className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(c.created_at)}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {c.body}
                  </p>
                </div>
                {viewerId === c.user_id && (
                  <button
                    type="button"
                    aria-label="コメントを削除"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {viewerId ? (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="コメントを追加…"
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={pending || body.trim().length === 0}
                className={cn(
                  "self-end rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity",
                  (pending || body.trim().length === 0) && "opacity-50"
                )}
              >
                {pending ? "送信中…" : "送信"}
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              コメントするにはログインが必要です。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
