"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Sparkles, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "ホーム", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/search",
    label: "検索",
    icon: Search,
    match: (p: string) => p === "/search" || p.startsWith("/search/"),
  },
  {
    href: "/events/new",
    label: "投稿",
    icon: PlusCircle,
    match: (p: string) => p === "/events/new",
  },
  {
    href: "/feed",
    label: "フィード",
    icon: Sparkles,
    match: (p: string) => p === "/feed" || p.startsWith("/feed/"),
  },
  {
    href: "/me",
    label: "マイページ",
    icon: User,
    match: (p: string) => p === "/me" || p.startsWith("/me/"),
  },
];

// PC (sm 以上) 用の横並びナビ。モバイルは BottomNav が担うため hidden。
export function MainNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
