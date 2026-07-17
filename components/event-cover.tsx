import { cn } from "@/lib/utils";
import { CategoryCover } from "@/components/category-cover";
import { optimizeImageUrl } from "@/lib/images";
import type { EventCategory } from "@/lib/events";

// イベントカードのカバー領域。
// cover_image_url があればその画像、無ければカテゴリー別のプレースホルダー画像。
// 屋台がある場合は「屋台あり」バッジを左上に重ねる。
export function EventCover({
  coverImageUrl,
  category,
  hasFoodStalls,
  className,
  rounded,
  title,
  width,
}: {
  coverImageUrl: string | null;
  category: EventCategory;
  hasFoodStalls?: boolean | null;
  className?: string; // サイズ指定（例: "h-40 w-full" / "h-20 w-20 shrink-0"）
  rounded?: boolean;
  title?: string; // 実カバー画像の alt に使うイベント名
  width?: number; // 最適化する表示幅(px)。Retina考慮で実寸の約2倍を渡す。既定=カード相当
}) {
  const optimized = optimizeImageUrl(coverImageUrl, width ?? 800);
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        rounded && "rounded",
        className,
      )}
    >
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={optimized ?? coverImageUrl}
          alt={title ?? ""}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <CategoryCover category={category} className="h-full w-full" />
      )}
      {hasFoodStalls && (
        <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          屋台あり
        </span>
      )}
    </div>
  );
}
