"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitReport, type ReportState } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: ReportState = { status: "idle" };

export function ReportForm({
  eventId,
  eventTitle,
  defaultAttendedOn,
}: {
  eventId: string;
  eventTitle: string;
  defaultAttendedOn: string;
}) {
  const action = submitReport.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [previews, setPreviews] = useState<string[]>([]);

  if (state.status === "success") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm">
        <p className="text-base font-semibold">投稿しました 🎉</p>
        <p className="mt-2 text-muted-foreground">
          みんなの「行ってきた」に並びました。素敵な体験をシェアしてくれてありがとう！
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/events/${eventId}`} className={buttonVariants({ size: "sm" })}>
            イベントページへ
          </Link>
          <Link
            href="/me"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            マイページ
          </Link>
        </div>
      </div>
    );
  }

  const v = state.status === "error" ? state.values ?? { memo: "", rating: "", attended_on: "" } : { memo: "", rating: "", attended_on: "" };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <p className="text-muted-foreground">レポート対象</p>
        <p className="mt-1 font-semibold">{eventTitle}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="attended_on">参加日</Label>
        <Input
          id="attended_on"
          name="attended_on"
          type="date"
          defaultValue={v.attended_on || defaultAttendedOn}
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rating">満足度（任意）</Label>
        <Select
          id="rating"
          name="rating"
          defaultValue={v.rating ?? ""}
          disabled={pending}
        >
          <option value="">未評価</option>
          <option value="5">★★★★★ 最高</option>
          <option value="4">★★★★☆ 良かった</option>
          <option value="3">★★★☆☆ ふつう</option>
          <option value="2">★★☆☆☆ いまいち</option>
          <option value="1">★☆☆☆☆ 残念</option>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="memo">感想</Label>
        <Textarea
          id="memo"
          name="memo"
          maxLength={2000}
          rows={6}
          defaultValue={v.memo ?? ""}
          placeholder="どんなところが良かった？印象に残った瞬間は？"
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="photos">写真（最大 6 枚 / 1 枚 5MB まで）</Label>
        <input
          id="photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={pending}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 6);
            setPreviews(files.map((f) => URL.createObjectURL(f)));
          }}
          className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
        />
        {previews.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {previews.map((src, i) => (
              <li
                key={i}
                className="aspect-square overflow-hidden rounded border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "送信中..." : "レポートを投稿"}
        </Button>
        <Link
          href={`/events/${eventId}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
