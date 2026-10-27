import Link from "next/link";
import type { Metadata } from "next";
import { LinkPills } from "@/components/landing-links";
import { PARENT_CATEGORIES, PARENT_LABELS } from "@/lib/events";
import { areaLabel, monthLabel, monthSlugOf, upcomingMonths } from "@/lib/landing";

const FEATURED_AREAS = [
  "渋谷", "新宿", "港", "千代田", "中央", "台東",
  "墨田", "豊島", "江東", "世田谷", "横浜", "さいたま",
];

export const metadata: Metadata = {
  title: "開催月から探す｜東京・関東のイベント",
  description:
    "今月・来月・再来月と、月ごとに東京・神奈川・埼玉・千葉のイベントを探せます。旅行や週末のおでかけの予定づくりに。",
  alternates: { canonical: "/events/month" },
};

export default function MonthIndexPage() {
  const months = upcomingMonths(12);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <nav aria-label="パンくず" className="mb-4 text-xs text-muted-foreground">
        <Link href="/events" className="hover:text-foreground hover:underline">
          イベント
        </Link>
        {" / "}
        <span className="text-foreground">開催月から探す</span>
      </nav>

      <header className="mb-10 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">開催月から探す</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          月ごとに東京・関東のイベントをまとめています。おでかけや旅行の予定づくりにどうぞ。
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {months.map((m) => (
          <li key={monthSlugOf(m)}>
            <Link
              href={`/events/month/${monthSlugOf(m)}`}
              className="block rounded-md border border-border px-4 py-3 text-sm font-medium transition-colors hover:border-foreground hover:bg-muted"
            >
              {monthLabel(m)}
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-14 flex flex-col gap-8 border-t border-border pt-8">
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
