"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-5",
                    active ? "stroke-[2.25]" : "stroke-[1.75]"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
