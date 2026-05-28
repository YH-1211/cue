import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/login/actions";
import { Button, buttonVariants } from "@/components/ui/button";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">Cue</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            行きたいが、見つかる。
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/events"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            イベント
          </Link>
          <Link
            href="/feed"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            フィード
          </Link>
          <Link
            href="/news"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ニュース
          </Link>
          <Link
            href="/calendar"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            季節
          </Link>
          <Link
            href="/me"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            マイページ
          </Link>

          {user ? (
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                ログアウト
              </Button>
            </form>
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ size: "sm" })}
            >
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
