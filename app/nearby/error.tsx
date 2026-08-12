"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function NearbyError({
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
        近くのイベントを読み込めませんでした
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        位置情報の取得に失敗したか、一時的な問題の可能性があります。もう一度お試しください。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={reset}>
          もう一度試す
        </Button>
        <Link
          href="/events"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          イベント一覧へ
        </Link>
      </div>
    </div>
  );
}
