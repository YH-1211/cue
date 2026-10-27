import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { EventGrid, type EventListItem } from "@/components/event-card";
import { LinkPills } from "@/components/landing-links";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  PARENT_CATEGORIES,
  PARENT_EMOJI,
  PARENT_LABELS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  categoriesUnderParent,
  isEventCategory,
  isParentCategory,
  parentOf,
} from "@/lib/events";
import { jstParts } from "@/lib/datetime";
import {
  EVENT_LIST_COLUMNS,
  areaLabel,
  listCutoffIso,
  monthLabel,
  monthSlugOf,
  upcomingMonths,
} from "@/lib/landing";
import { AREAS_BY_PREFECTURE } from "@/lib/tokyo-areas";

type Props = { params: Promise<{ category: string }> };

const LIMIT = 60;

// 「渋谷のイルミネーション」みたいな組み合わせで探されやすい主要エリア。
// 全33区市を出すとリンクが薄まるので、人が集まるところに絞る。
const FEATURED_AREAS = [
  "渋谷", "新宿", "港", "千代田", "中央", "台東",
  "墨田", "豊島", "江東", "世田谷", "横浜", "さいたま",
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isEventCategory(category)) return { title: "ジャンル" };
  const label = CATEGORY_LABELS[category];
  const { year } = jstParts(new Date());
  return {
    title: `${label} ${year}｜東京・関東のイベント一覧`,
    description: `東京・神奈川・埼玉・千葉で開催される「${label}」のイベント一覧。開催日・会場・料金をまとめてチェックできます。開催が近い順に掲載。`,
    alternates: { canonical: `/events/category/${category}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isEventCategory(category)) notFound();

  const label = CATEGORY_LABELS[category];
  const parent = parentOf(category);
  const isParent = isParentCategory(category);
  const { year } = jstParts(new Date());

  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select(EVENT_LIST_COLUMNS, { count: "exact" })
    .eq("approved", true)
    .gte("effective_end", listCutoffIso())
    .order("starts_at", { ascending: true })
    .limit(LIMIT);

  query = isParent
    ? query.in("category", categoriesUnderParent(category))
    : query.eq("category", category);

  const { data, error, count } = await query;
  if (error) console.error("[events/category] query failed:", error);
  const events = (data ?? []) as unknown as EventListItem[];
  const total = count ?? events.length;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12">
      <nav aria-label="パンくず" className="mb-4 text-xs text-muted-foreground">
        <Link href="/events" className="hover:text-foreground hover:underline">
          イベント
        </Link>
        {" / "}
        <Link href="/events/category" className="hover:text-foreground hover:underline">
          ジャンルから探す
        </Link>
        {!isParent && (
          <>
            {" / "}
            <Link
              href={`/events/category/${parent}`}
              className="hover:text-foreground hover:underline"
            >
              {PARENT_LABELS[parent]}
            </Link>
          </>
        )}
        {" / "}
        <span className="text-foreground">{label}</span>
      </nav>

      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {PARENT_EMOJI[parent]} {label}のイベント {year}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          東京・神奈川・埼玉・千葉で開催される「{label}」のイベントを{total}
          件掲載しています。開催が近い順に並んでいます。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/search?categories=${category}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            🔍 条件を足して検索
          </Link>
          <Link
            href="/events"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            すべてのイベント
          </Link>
        </div>
      </header>

      {events.length === 0 ? (
        <EmptyState title={`「${label}」の予定はまだありません。`} />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {total} 件中 {events.length} 件を表示
          </p>
          <EventGrid events={events} />
          {total > events.length && (
            <div className="mt-8 flex justify-center">
              <Link
                href={`/events?category=${category}&show=200`}
                className={buttonVariants({ variant: "outline" })}
              >
                もっと見る (残り {total - events.length} 件)
              </Link>
            </div>
          )}
        </>
      )}

      <section className="mt-14 flex flex-col gap-8 border-t border-border pt-8">
        <LinkPills
          label={`${PARENT_LABELS[parent]}の細かいジャンル`}
          activeHref={`/events/category/${category}`}
          links={[
            {
              href: `/events/category/${parent}`,
              text: `${PARENT_LABELS[parent]} (すべて)`,
            },
            ...SUBCATEGORIES[parent].map((s) => ({
              href: `/events/category/${s}`,
              text: SUBCATEGORY_LABELS[s] ?? s,
            })),
          ]}
        />
        <LinkPills
          label="他のジャンル"
          links={PARENT_CATEGORIES.filter((c) => c !== parent).map((c) => ({
            href: `/events/category/${c}`,
            text: PARENT_LABELS[c],
          }))}
        />
        <LinkPills
          label="エリアから探す"
          links={FEATURED_AREAS.filter(
            (a) =>
              a in AREAS_BY_PREFECTURE.東京 ||
              a in AREAS_BY_PREFECTURE.神奈川 ||
              a in AREAS_BY_PREFECTURE.埼玉 ||
              a in AREAS_BY_PREFECTURE.千葉,
          ).map((a) => ({
            href: `/events/area/${encodeURIComponent(a)}`,
            text: areaLabel(a),
          }))}
        />
        <LinkPills
          label="開催月から探す"
          links={upcomingMonths(6).map((m) => ({
            href: `/events/month/${monthSlugOf(m)}`,
            text: monthLabel(m),
          }))}
        />
      </section>
    </div>
  );
}
