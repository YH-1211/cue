import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border mt-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{SITE.name}</span>
            <span className="text-xs text-muted-foreground">
              行きたいが、見つかる。
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              利用規約
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              プライバシーポリシー
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              お問い合わせ
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          © {year} {SITE.operator}
        </p>
      </div>
    </footer>
  );
}
