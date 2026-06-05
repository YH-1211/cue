import { cn } from "@/lib/utils";
import { CategoryCover } from "@/components/category-cover";
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
}: {
  coverImageUrl: string | null;
  category: EventCategory;
  hasFoodStalls?: boolean | null;
  className?: string; // サイズ指定（例: "h-40 w-full" / "h-20 w-20 shrink-0"）
  rounded?: boolean;
}) {
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
          src={coverImageUrl}
          alt=""
          loading="lazy"
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
