"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-6xl">⚠️</p>
      <h1 className="mt-4 text-xl font-semibold">
        イベント情報を読み込めませんでした
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        一時的な問題の可能性があります。少し待ってからもう一度お試しください。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={reset}>
          もう一度試す
        </Button>
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
