import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { LinkPills } from "@/components/landing-links";
import { PARENT_CATEGORIES, PARENT_LABELS } from "@/lib/events";
import { AREAS_BY_PREFECTURE, PREFECTURES } from "@/lib/tokyo-areas";
import {
  areaLabel,
  listCutoffIso,
  monthLabel,
  monthSlugOf,
  upcomingMonths,
} from "@/lib/landing";

export const metadata: Metadata = {
  title: "エリアから探す｜東京・関東のイベント",
  description:
    "渋谷・新宿・浅草・横浜など、東京・神奈川・埼玉・千葉のエリア別にイベントを探せます。お出かけ先の街から、これから行けるイベントを見つけてください。",
  alternates: { canonical: "/events/area" },
};

export default async function AreaIndexPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("area")
    .eq("approved", true)
    .gte("effective_end", listCutoffIso())
    .limit(2000);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { area: string | null }[]) {
    if (!row.area) continue;
    counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <nav aria-label="パンくず" className="mb-4 text-xs text-muted-foreground">
        <Link href="/events" className="hover:text-foreground hover:underline">
          イベント
        </Link>
        {" / "}
        <span className="text-foreground">エリアから探す</span>
      </nav>

      <header className="mb-10 flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">エリアから探す</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          東京・神奈川・埼玉・千葉の市区別に、これから開催されるイベントをまとめています。
          数字は現在掲載中の件数です。
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {PREFECTURES.map((pref) => {
          const areas = Object.keys(AREAS_BY_PREFECTURE[pref]).filter(
            (a) => (counts.get(a) ?? 0) > 0,
          );
          if (areas.length === 0) return null;
          return (
            <section key={pref}>
              <h2 className="mb-3 text-xl font-semibold tracking-tight">{pref}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {areas.map((a) => (
                  <li key={a}>
                    <Link
                      href={`/events/area/${encodeURIComponent(a)}`}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-foreground hover:bg-muted"
                    >
                      <span>{areaLabel(a)}</span>
                      <span className="text-xs text-muted-foreground">
                        {counts.get(a)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-14 flex flex-col gap-8 border-t border-border pt-8">
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
