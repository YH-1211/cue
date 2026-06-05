import { cn } from "@/lib/utils";
import { parentOf, type EventCategory, type ParentCategory } from "@/lib/events";

// 親カテゴリーごとのプレースホルダー画像（public/categories/*.jpg）。
// cover_image_url が無いイベントの背景に使う。
const IMAGES: Record<ParentCategory, string> = {
  art: "/categories/art.jpg",
  music: "/categories/music.jpg",
  theater: "/categories/theater.jpg",
  festival: "/categories/festival.jpg",
  food: "/categories/food.jpg",
  seasonal: "/categories/seasonal.jpg",
  film: "/categories/film.jpg",
  learning: "/categories/learning.jpg",
  sports: "/categories/sports.jpg",
};

export function CategoryCover({
  category,
  className,
}: {
  category: EventCategory;
  className?: string;
}) {
  const src = IMAGES[parentOf(category)];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      className={cn("object-cover", className)}
    />
  );
}
