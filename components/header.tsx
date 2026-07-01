import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { AppearanceMenu } from "@/components/appearance-menu";
import { MainNav } from "@/components/main-nav";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        {/* 左: ロゴ + PC用ナビ (モバイルは BottomNav が担う) */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Cue
          </Link>
          <MainNav />
        </div>

        {/* 右: ニュース / 表示設定 / ログイン */}
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/news"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ニュース
          </Link>

          <AppearanceMenu />

          {!user && (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
