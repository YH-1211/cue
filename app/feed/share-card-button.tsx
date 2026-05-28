"use client";

import { useState } from "react";

export function ShareCardButton({
  attendedEventId,
  eventTitle,
}: {
  attendedEventId: string;
  eventTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const url = `/api/og/attended/${attendedEventId}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        共有カード
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">シェアカード</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                閉じる
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${eventTitle} のシェアカード`}
                className="block w-full"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              長押し / 右クリックで画像を保存できます。X などに添付して共有しよう。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={url}
                download={`cue-${attendedEventId}.png`}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
              >
                ダウンロード
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `行ってきた：${eventTitle} #Cue`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
              >
                X で投稿
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
