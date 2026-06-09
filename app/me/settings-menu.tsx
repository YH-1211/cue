"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

type Props = {
  admin: boolean;
  pendingCount: number;
};

const SETTINGS_LINKS = [
  { href: "/me/profile", label: "プロフィールを編集" },
  { href: "/me/notifications", label: "通知設定" },
  { href: "/me/saved-searches", label: "保存した検索" },
  { href: "/me/follows", label: "フォロー" },
];

const ADMIN_LINKS = [
  { href: "/admin/moderation", label: "⚙ モデレーション" },
  { href: "/admin/sources", label: "🔌 取り込みソース" },
  { href: "/admin/news", label: "📰 ニュース管理" },
  { href: "/admin/contact", label: "✉️ お問い合わせ" },
  { href: "/admin/admins", label: "👤 管理者" },
  { href: "/admin/cron", label: "📊 Cron 実行履歴" },
];

export function SettingsMenu({ admin, pendingCount }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="設定"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Settings className="size-5" />
        {admin && pendingCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          {SETTINGS_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}

          {admin && (
            <>
              <div className="my-1 border-t border-border" />
              <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                管理
              </p>
              {ADMIN_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-muted"
                >
                  <span>{l.label}</span>
                  {l.href === "/admin/moderation" && pendingCount > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              ))}
            </>
          )}

          <div className="my-1 border-t border-border" />
          <form action={signOut}>
            <button
              type="submit"
              className={cn(
                "block w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-muted"
              )}
            >
              ログアウト
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
