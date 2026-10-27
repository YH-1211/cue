import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { EventGrid, type EventListItem } from "@/components/event-card";
import { LinkPills } from "@/components/landing-links";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PARENT_CATEGORIES, PARENT_LABELS } from "@/lib/events";
import {
  EVENT_LIST_COLUMNS,
  areaLabel,
  listCutoffIso,
  monthLabel,
  monthRangeIso,
  monthSlugOf,
  parseMonthSlug,
  upcomingMonths,
} from "@/lib/landing";

type Props = {
  params: Promise<{ ym: string }>;
  searchParams: Promise<{ show?: string }>;
};

const PAGE_SIZE = 100;
const MAX_SHOW = 500;

// ハブやリンクに出す主要エリア
const FEATURED_AREAS = [
  "渋谷", "新宿", "港", "千代田", "中央", "台東",
  "墨田", "豊島", "江東", "世田谷", "横浜", "さいたま",
];

// 遠すぎる未来の月ページを無限に生やさない上限
const MAX_MONTHS_AHEAD = 18;

function monthIndex(year: number, month: number) {
  return year * 12 + (month - 1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = parseMonthSlug((await params).ym);
  if (!slug) return { title: "開催月" };
  const label = monthLabel(slug);
  const { end } = monthRangeIso(slug);
  const past = end <= listCutoffIso();
  return {
    title: `${label}の東京・関東イベント`,
    description: `${label}に東京・神奈川・埼玉・千葉で開催されるイベントの一覧。祭り・花火大会・展覧会・音楽ライブ・イルミネーションを開催日順にまとめています。`,
    alternates: { canonical: `/events/month/${monthSlugOf(slug)}` },
    // 終わった月は中身が空になるのでインデックスさせない
    ...(past ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function MonthPage({ params, searchParams }: Props) {
  const slug = parseMonthSlug((await params).ym);
  if (!slug) notFound();

  // 表示件数。URL から受け取るので上限を設けて過大なクエリを防ぐ
  const parsedShow = Number.parseInt((await searchParams).show ?? "", 10);
  const show = Number.isFinite(parsedShow)
    ? Math.min(Math.max(parsedShow, PAGE_SIZE), MAX_SHOW)
    : PAGE_SIZE;

  const now = new Date();
  const current = upcomingMonths(1, now)[0];
  const ahead = monthIndex(slug.year, slug.month) - monthIndex(current.year, current.month);
  if (ahead > MAX_MONTHS_AHEAD) notFound();

  const label = monthLabel(slug);
  const { start, end } = monthRangeIso(slug);
  const cutoff = listCutoffIso(now);
  // その月に開催中のもの。ただし既に終わったイベントは出さない。
  const from = start > cutoff ? start : cutoff;
  const isPast = end <= cutoff;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("events")
    .select(EVENT_LIST_COLUMNS, { count: "exact" })
    .eq("approved", true)
    .lt("starts_at", end)
    .gte("effective_end", from)
    .order("starts_at", { ascending: true })
    .limit(show);

  if (error) console.error("[events/month] query failed:", error);
  const events = (data ?? []) as unknown as EventListItem[];
  const total = count ?? events.length;

  const prev = new Date(Date.UTC(slug.year, slug.month - 2, 1));
  const next = new Date(Date.UTC(slug.year, slug.month, 1));
  const prevSlug = { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
  const nextSlug = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12">
      <nav aria-label="パンくず" className="mb-4 text-xs text-muted-foreground">
        <Link href="/events" className="hover:text-foreground hover:underline">
          イベント
        </Link>
        {" / "}
        <Link href="/events/month" className="hover:text-foreground hover:underline">
          開催月から探す
        </Link>
        {" / "}
        <span className="text-foreground">{label}</span>
      </nav>

      <header className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {label}の東京・関東イベント
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {label}に東京・神奈川・埼玉・千葉で開催されるイベントを{total}
          件掲載しています。祭り・花火大会・展覧会・音楽ライブ・イルミネーションなどを
          開催日順に並べています。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/events/month/${monthSlugOf(prevSlug)}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            ← {monthLabel(prevSlug)}
          </Link>
          <Link
            href={`/events/month/${monthSlugOf(nextSlug)}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {monthLabel(nextSlug)} →
          </Link>
          <Link
            href="/calendar"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            📅 カレンダーで見る
          </Link>
        </div>
      </header>

      {events.length === 0 ? (
        <EmptyState
          title={
            isPast
              ? `${label}はすでに終了しています。`
              : `${label}のイベントはまだ登録されていません。`
          }
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {total} 件中 {events.length} 件を表示
          </p>
          <EventGrid events={events} />
          {total > events.length && (
            <div className="mt-8 flex justify-center">
              <Link
                href={`/events/month/${monthSlugOf(slug)}?show=${Math.min(
                  show + PAGE_SIZE,
                  MAX_SHOW,
                )}`}
                scroll={false}
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
          label="他の月から探す"
          activeHref={`/events/month/${monthSlugOf(slug)}`}
          links={upcomingMonths(12, now).map((m) => ({
            href: `/events/month/${monthSlugOf(m)}`,
            text: monthLabel(m),
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
          label="エリアから探す"
          links={FEATURED_AREAS.map((a) => ({
            href: `/events/area/${encodeURIComponent(a)}`,
            text: areaLabel(a),
          }))}
        />
      </section>
    </div>
  );
}
