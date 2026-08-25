"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  generateLineLinkCode,
  unlinkLine,
  updateLineNotify,
} from "./actions";

type Props = {
  linked: boolean;
  notifyViaLine: boolean;
  addFriendUrl: string | null;
};

export function LineSection({ linked, notifyViaLine, addFriendUrl }: Props) {
  const [isLinked, setIsLinked] = useState(linked);
  const [notify, setNotify] = useState(notifyViaLine);
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "ok" | "error"; msg: string }
  >({ kind: "idle" });

  function issueCode() {
    start(async () => {
      const res = await generateLineLinkCode();
      if (res.ok) {
        setCode(res.code);
        setStatus({ kind: "idle" });
      } else {
        setStatus({ kind: "error", msg: res.error });
      }
    });
  }

  function unlink() {
    start(async () => {
      const res = await unlinkLine();
      if (res.ok) {
        setIsLinked(false);
        setCode(null);
        setStatus({ kind: "ok", msg: "連携を解除しました" });
      } else {
        setStatus({ kind: "error", msg: res.error });
      }
    });
  }

  function toggleNotify(next: boolean) {
    setNotify(next);
    start(async () => {
      const res = await updateLineNotify(next);
      if (!res.ok) {
        setNotify(!next);
        setStatus({ kind: "error", msg: res.error });
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">LINE で通知を受け取る</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            LINE と連携すると、iPhone でもアプリを開かず通知を受け取れます。
          </p>
        </div>
        {isLinked && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
            連携済み
          </span>
        )}
      </div>

      {isLinked ? (
        <div className="mt-5 flex flex-col gap-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => toggleNotify(e.target.checked)}
              disabled={pending}
              className="size-4 accent-foreground"
            />
            <span>LINE で通知を受け取る</span>
          </label>
          <div className="flex items-center justify-end gap-3">
            {status.kind !== "idle" && (
              <span
                className={
                  "text-xs " +
                  (status.kind === "error"
                    ? "text-red-600"
                    : "text-emerald-600")
                }
              >
                {status.msg}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={unlink}
              disabled={pending}
            >
              連携を解除
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              {addFriendUrl ? (
                <a
                  href={addFriendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Que 公式 LINE を友だち追加
                </a>
              ) : (
                "Que 公式 LINE を友だち追加"
              )}
            </li>
            <li>下のボタンで連携コードを発行</li>
            <li>そのコードを LINE のトークに送信</li>
          </ol>

          {code ? (
            <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-center">
              <p className="text-xs text-muted-foreground">連携コード</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em]">
                {code}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                このコードを LINE のトークに送ってください (10 分間有効)
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            {status.kind === "error" && (
              <span className="text-xs text-red-600">{status.msg}</span>
            )}
            <Button size="sm" onClick={issueCode} disabled={pending}>
              {pending
                ? "発行中..."
                : code
                  ? "コードを再発行"
                  : "連携コードを発行"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
