import Link from "next/link";

// ランディングページ同士をつなぐ内部リンク群。
// 「検出 - インデックス未登録」のページはたいてい内部リンクが薄いせいで
// 優先度を下げられているので、各ページから隣のページへ必ずリンクを張る。
export function LinkPills({
  label,
  links,
  activeHref,
}: {
  label: string;
  links: { href: string; text: string; count?: number }[];
  activeHref?: string;
}) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={label} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => {
          const active = l.href === activeHref;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground")
              }
            >
              {l.text}
              {typeof l.count === "number" && (
                <span className="ml-1 text-xs opacity-70">{l.count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
