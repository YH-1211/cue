"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Home, CalendarDays, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
};

const items: Item[] = [
  {
    href: "/",
    label: "ホーム",
    icon: Home,
    match: (p) => p === "/",
  },
  {
    href: "/events",
    label: "イベント",
    icon: CalendarDays,
    match: (p) => p === "/events" || (p.startsWith("/events/") && p !== "/events/new"),
  },
  {
    href: "/events/new",
    label: "投稿",
    icon: PlusCircle,
    match: (p) => p === "/events/new",
  },
  {
    href: "/me",
    label: "マイページ",
    icon: User,
    match: (p) => p === "/me" || p.startsWith("/me/"),
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const [pending, startTransition] = useTransition();

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        // 下スワイプジェスチャ等で発生する遅延を抑制
        touchAction: "manipulation",
      }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                onClick={() => startTransition(() => {})}
                className={cn(
                  // 高さ 64px + 上下中央配置、タップ領域を広げる
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-muted",
                  "select-none [-webkit-tap-highlight-color:transparent]",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={{ touchAction: "manipulation" }}
              >
                <Icon
                  className={cn(
                    "size-6 transition-transform",
                    active ? "stroke-[2.25] scale-110" : "stroke-[1.75]",
                    pending && active && "animate-pulse"
                  )}
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
