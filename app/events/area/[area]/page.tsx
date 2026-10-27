import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { EventGrid, type EventListItem } from "@/components/event-card";
import { LinkPills } from "@/components/landing-links";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PARENT_CATEGORIES, PARENT_LABELS } from "@/lib/events";
import { AREAS_BY_PREFECTURE } from "@/lib/tokyo-areas";
import {
  ALL_AREAS,
  EVENT_LIST_COLUMNS,
  areaLabel,
  isKnownArea,
  listCutoffIso,
  monthLabel,
  monthSlugOf,
  prefectureOfArea,
  safeDecode,
  upcomingMonths,
} from "@/lib/landing";

type Props = { params: Promise<{ area: string }> };

const LIMIT = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = safeDecode((await params).area);
  if (!isKnownArea(area)) return { title: "エリア" };
  const label = areaLabel(area);
  return {
    title: `${label}のイベント・おでかけ情報`,
    description: `${label}でこれから開催されるイベントの一覧。祭り・花火大会・展覧会・音楽ライブ・イルミネーションなど、${label}のおでかけ先をまとめています。`,
    alternates: { canonical: `/events/area/${encodeURIComponent(area)}` },
  };
}

export default async function AreaPage({ params }: Props) {
  const area = safeDecode((await params).area);
  if (!isKnownArea(area)) notFound();

  const label = areaLabel(area);
  const prefecture = prefectureOfArea(area);

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("events")
    .select(EVENT_LIST_COLUMNS, { count: "exact" })
    .eq("approved", true)
    .eq("area", area)
    .gte("effective_end", listCutoffIso())
    .order("starts_at", { ascending: true })
    .limit(LIMIT);

  if (error) console.error("[events/area] query failed:", error);
  const events = (data ?? []) as unknown as EventListItem[];
  const total = count ?? events.length;

  // 同じ都県の他エリア (自分を含む)
  const siblings = prefecture ? Object.keys(AREAS_BY_PREFECTURE[prefecture]) : ALL_AREAS;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12">
      <nav aria-label="パンくず" className="mb-4 text-xs text-muted-foreground">
        <Link href="/events" className="hover:text-foreground hover:underline">
          イベント
        </Link>
        {" / "}
        <Link href="/events/area" className="hover:text-foreground hover:underline">
          エリアから探す
        </Link>
        {" / "}
        <span className="text-foreground">{label}</span>
      </nav>

      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {label}のイベント・おでかけ情報
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {label}でこれから開催されるイベントを{total}件掲載しています。
          祭り・花火大会・展覧会・音楽ライブ・イルミネーションなど、
          開催日が近い順に並べています。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/search?areas=${encodeURIComponent(area)}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            🔍 {label}を絞り込んで検索
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
        <EmptyState title={`${label}で予定されているイベントはまだありません。`} />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {total} 件中 {events.length} 件を表示
          </p>
          <EventGrid events={events} />
          {total > events.length && (
            <div className="mt-8 flex justify-center">
              <Link
                href={`/events?area=${encodeURIComponent(area)}&show=200`}
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
          label={prefecture ? `${prefecture}の他のエリア` : "他のエリア"}
          activeHref={`/events/area/${encodeURIComponent(area)}`}
          links={siblings.map((a) => ({
            href: `/events/area/${encodeURIComponent(a)}`,
            text: areaLabel(a),
          }))}
        />
        <LinkPills
          label="ジャンルから探す"
          links={PARENT_CATEGORIES.map((c) => ({
            href: `/events/category/${c}`,
            text: PARENT_LABELS[c],
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
