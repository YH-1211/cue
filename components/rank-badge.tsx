import { cn } from "@/lib/utils";
import { rankFor } from "@/lib/rank";

type Props = {
  points: number;
  className?: string;
  /** true なら "称号" のみ、false ならポイントも併記 */
  compact?: boolean;
};

export function RankBadge({ points, className, compact }: Props) {
  const rank = rankFor(points);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        rank.className,
        className
      )}
    >
      <span aria-hidden>{rank.icon}</span>
      <span>{rank.label}</span>
      {!compact && <span className="tabular-nums opacity-70">{points}pt</span>}
    </span>
  );
}
