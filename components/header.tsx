import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { AppearanceMenu } from "@/components/appearance-menu";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-end px-4">
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/news"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ニュース
          </Link>

          <AppearanceMenu />

          {!user && (
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
