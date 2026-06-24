import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-6xl font-bold tracking-tight text-muted-foreground/40">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        お探しのページは削除されたか、URL が間違っている可能性があります。
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonVariants({ size: "sm" })}>
          ホームへ戻る
        </Link>
        <Link
          href="/events"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          イベントを探す
        </Link>
      </div>
    </div>
  );
}
