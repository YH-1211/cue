import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { LinkPills } from "@/components/landing-links";
import {
  PARENT_CATEGORIES,
  PARENT_EMOJI,
  PARENT_LABELS,
  SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  isEventCategory,
  parentOf,
  type EventCategory,
} from "@/lib/events";
import {
  areaLabel,
  listCutoffIso,
  monthLabel,
  monthSlugOf,
  upcomingMonths,
} from "@/lib/landing";

const FEATURED_AREAS = [
  "渋谷", "新宿", "港", "千代田", "中央", "台東",
  "墨田", "豊島", "江東", "世田谷", "横浜", "さいたま",
];

export const metadata: Metadata = {
  title: "ジャンルから探す｜東京・関東のイベント",
  description:
    "祭り・花火大会・展覧会・音楽ライブ・イルミネーション・グルメフェスなど、ジャンル別に東京・関東のイベントを探せます。",
  alternates: { canonical: "/events/category" },
};

export default async function CategoryIndexPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("category")
    .eq("approved", true)
    .gte("effective_end", listCutoffIso())
    .limit(2000);

  // サブカテゴリ単位と親カテゴリ単位、両方の件数を数える
  const subCounts = new Map<string, number>();
  const parentCounts = new Map<string, number>();
  for (const row of (data ?? []) as { category: string | null }[]) {
    const c = row.category;
    if (!c || !isEventCategory(c)) continue;
    subCounts.set(c, (subCounts.get(c) ?? 0) + 1);
    const p = parentOf(c as EventCategory);
    parentCounts.set(p, (parentCounts.get(p) ?? 0) + 1);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <nav aria-label="パンくず" className="mb-4 text-xs text-muted-foreground">
        <Link href="/events" className="hover:text-foreground hover:underline">
          イベント
        </Link>
        {" / "}
        <span className="text-foreground">ジャンルから探す</span>
      </nav>

      <header className="mb-10 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">ジャンルから探す</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          祭り・花火大会・展覧会・音楽ライブ・イルミネーションなど、
          ジャンル別にこれから開催されるイベントをまとめています。数字は現在掲載中の件数です。
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {PARENT_CATEGORIES.map((p) => {
          const subs = SUBCATEGORIES[p].filter((s) => (subCounts.get(s) ?? 0) > 0);
          const parentCount = parentCounts.get(p) ?? 0;
          return (
            <section key={p}>
              <h2 className="mb-3 text-xl font-semibold tracking-tight">
                <Link
                  href={`/events/category/${p}`}
                  className="hover:underline"
                >
                  {PARENT_EMOJI[p]} {PARENT_LABELS[p]}
                </Link>
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {parentCount}件
                </span>
              </h2>
              {subs.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {subs.map((s) => (
                    <li key={s}>
                      <Link
                        href={`/events/category/${s}`}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-foreground hover:bg-muted"
                      >
                        <span>{SUBCATEGORY_LABELS[s] ?? s}</span>
                        <span className="text-xs text-muted-foreground">
                          {subCounts.get(s)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  いまは掲載中のイベントがありません。
                </p>
              )}
            </section>
          );
        })}
      </div>

      <section className="mt-14 flex flex-col gap-8 border-t border-border pt-8">
        <LinkPills
          label="エリアから探す"
          links={FEATURED_AREAS.map((a) => ({
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
