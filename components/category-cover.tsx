import { cn } from "@/lib/utils";
import { categoryCoverPath, type EventCategory } from "@/lib/events";

export function CategoryCover({
  category,
  className,
}: {
  category: EventCategory;
  className?: string;
}) {
  const src = categoryCoverPath(category);
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
