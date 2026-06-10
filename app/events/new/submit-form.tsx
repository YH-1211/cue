"use client";

import Link from "next/link";
import { submitEvent, fetchEventFromUrl } from "./actions";
import { buttonVariants } from "@/components/ui/button";
import { EventForm } from "@/components/events/event-form";

export function SubmitForm() {
  return (
    <EventForm
      submitAction={submitEvent}
      fetchAction={fetchEventFromUrl}
      submitLabel="投稿する"
      renderSuccess={() => (
        <div className="rounded-lg border border-border bg-card p-6 text-sm">
          <p className="text-base font-semibold">投稿ありがとうございます 🎉</p>
          <p className="mt-2 text-muted-foreground">
            管理者の承認後、イベント一覧に公開されます。
            承認されると{" "}
            <span className="font-medium text-foreground">+10pt</span>{" "}
            が加算されます（ポイント機能は準備中）。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/me" className={buttonVariants({ size: "sm" })}>
              マイページへ
            </Link>
            <Link
              href="/events/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              続けて投稿する
            </Link>
          </div>
        </div>
      )}
    />
  );
}
