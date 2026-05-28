import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-lg font-bold tracking-tight">Cue</span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              行きたいが、見つかる。
              <br />
              日本のイベント情報プラットフォーム。
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              サービス
            </span>
            <nav className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <Link href="/events" className="hover:text-foreground">
                イベント一覧
              </Link>
              <Link href="/calendar" className="hover:text-foreground">
                季節カレンダー
              </Link>
              <Link href="/search" className="hover:text-foreground">
                検索
              </Link>
              <Link href="/events/new" className="hover:text-foreground">
                イベントを掲載する
              </Link>
            </nav>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              企業情報
            </span>
            <nav className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <Link href="/corporate" className="hover:text-foreground">
                企業情報
              </Link>
              <a href="mailto:contact@cue.jp" className="hover:text-foreground">
                お問い合わせ
              </a>
            </nav>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Cue株式会社. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
