import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** 上部に表示するアイコン (lucide 等)。省略可 */
  icon?: ReactNode;
  /** メインの文言 */
  title: ReactNode;
  /** 補足文・リンク・ボタンなど (title の下に表示) */
  children?: ReactNode;
  className?: string;
};

// アプリ全体で共通の「空状態」表示。破線ボーダーの中央寄せカード。
// 一覧が空・未ログイン・検索ヒット0件などで使う。
export function EmptyState({ icon, title, children, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center",
        className
      )}
    >
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <p className="text-sm text-muted-foreground">{title}</p>
      {children && (
        <div className="text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}
