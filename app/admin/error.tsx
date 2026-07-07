"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

// 管理画面専用のエラーバウンダリ。管理者のみが見るため、
// 調査用に digest（エラー識別子）を表示する。詳細はサーバーログに残る。
export default function AdminError({
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
      <h1 className="mt-4 text-xl font-semibold">管理画面でエラーが発生しました</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        処理中に問題が発生しました。もう一度お試しください。
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          識別子: {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={reset}>
          もう一度試す
        </Button>
        <Link
          href="/me"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          マイページへ戻る
        </Link>
      </div>
    </div>
  );
}
