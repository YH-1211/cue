"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAffiliateUrl } from "./admin-actions";

// 管理者だけに見える、アフィリエイトリンクの登録欄。
// 登録するとチケットボタンの遷移先がこのURLになり、広告表記が自動で表示される。
export function AdminAffiliateForm({
  eventId,
  current,
}: {
  eventId: string;
  current: string | null;
}) {
  const [value, setValue] = useState(current ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

  const save = (next: string) => {
    setMsg(null);
    startTransition(async () => {
      const res = await setAffiliateUrl(eventId, next);
      if (res.ok) {
        setValue(next);
        setMsg({
          kind: "ok",
          text: next.trim() ? "保存しました。" : "解除しました。",
        });
      } else {
        setMsg({ kind: "error", text: res.message ?? "保存に失敗しました。" });
      }
    });
  };

  return (
    <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 p-4">
      <Label htmlFor="affiliate_url">アフィリエイトリンク（管理者のみ）</Label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        ASP で発行した成果報酬リンクを貼ると、「チケットを購入」ボタンの遷移先がこのURLに切り替わり、
        広告表記が自動で表示されます。空にすると通常のチケットURLに戻ります。
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          id="affiliate_url"
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://..."
          disabled={pending}
        />
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => save(value)}
            disabled={pending}
          >
            {pending ? "保存中..." : "保存"}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => save("")}
              disabled={pending}
            >
              解除
            </Button>
          )}
        </div>
      </div>
      {msg && (
        <p
          className={
            "mt-2 text-xs " +
            (msg.kind === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400")
          }
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
