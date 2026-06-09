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

// サブカテゴリー専用画像。より内容に合った写真がある分だけ用意し、
// 無いサブカテゴリーは親カテゴリーの画像にフォールバックする。
const SUB_IMAGES: Partial<Record<EventCategory, string>> = {
  sports_baseball: "/categories/sports_baseball.jpg",
  sports_soccer: "/categories/sports_soccer.jpg",
  sports_basketball: "/categories/sports_basketball.jpg",
  sports_marathon: "/categories/sports_marathon.jpg",
  festival_hanabi: "/categories/festival_hanabi.jpg",
  music_classic: "/categories/music_classic.jpg",
  music_jazz: "/categories/music_jazz.jpg",
  music_rock: "/categories/music_rock.jpg",
  art_contemporary: "/categories/art_contemporary.jpg",
  art_photo: "/categories/art_photo.jpg",
  art_craft: "/categories/art_craft.jpg",
};

export function CategoryCover({
  category,
  className,
}: {
  category: EventCategory;
  className?: string;
}) {
  const src = SUB_IMAGES[category] ?? IMAGES[parentOf(category)];
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
