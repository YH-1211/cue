"use client";

import Link from "next/link";
import { createEventByAdmin, fetchEventFromUrlAdmin } from "./actions";
import { buttonVariants } from "@/components/ui/button";
import { EventForm } from "@/components/events/event-form";

export function AdminEventForm() {
  return (
    <EventForm
      submitAction={createEventByAdmin}
      fetchAction={fetchEventFromUrlAdmin}
      submitLabel="作成して公開"
      renderSuccess={(eventId) => (
        <div className="rounded-lg border border-border bg-card p-6 text-sm">
          <p className="text-base font-semibold">イベントを公開しました ✅</p>
          <p className="mt-2 text-muted-foreground">
            承認済みとして即時に一覧へ反映されます。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/events/${eventId}`}
              className={buttonVariants({ size: "sm" })}
            >
              公開ページを見る
            </Link>
            <Link
              href="/admin/events/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              続けて作成する
            </Link>
          </div>
        </div>
      )}
    />
  );
}
