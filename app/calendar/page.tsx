import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventCategory } from "@/lib/events";
import { startOfTodayJstIso } from "@/lib/datetime";

export const metadata = { title: "季節カレンダー" };

type Cue = {
  key: string;
  emoji: string;
  title: string;
  hint: string;
  months: number[]; // 1-12
  q?: string;
  category?: EventCategory;
};

// 東京近辺の「季節の合図」。q は events.title/description の ilike にかかる
const CUES: Cue[] = [
  { key: "hatsumode", emoji: "⛩️", title: "初詣", hint: "新年の参拝・カウントダウン", months: [12, 1], q: "初詣", category: "festival" },
  { key: "setsubun", emoji: "👹", title: "節分・梅まつり", hint: "豆まきと梅の便り", months: [2], q: "梅" },
  { key: "hina", emoji: "🎎", title: "雛祭り・春の予感", hint: "ひな人形・春のイベント", months: [3], q: "ひな" },
  { key: "sakura", emoji: "🌸", title: "桜・花見", hint: "都内の桜スポット&夜桜", months: [3, 4], q: "桜", category: "festival" },
  { key: "gw", emoji: "🎏", title: "端午・GWイベント", hint: "こどもの日・大型連休の催し", months: [4, 5], q: "こいのぼり" },
  { key: "ajisai", emoji: "💠", title: "紫陽花", hint: "梅雨に映えるあじさい名所", months: [5, 6], q: "紫陽花" },
  { key: "tanabata", emoji: "🎋", title: "七夕", hint: "短冊と笹飾り", months: [7], q: "七夕", category: "festival" },
  { key: "hanabi", emoji: "🎆", title: "花火大会", hint: "隅田川・神宮外苑・東京湾", months: [7, 8], q: "花火", category: "festival" },
  { key: "matsuri", emoji: "🏮", title: "夏祭り・盆踊り", hint: "縁日・盆踊り・神輿", months: [7, 8], q: "盆踊り", category: "festival" },
  { key: "tsukimi", emoji: "🌕", title: "中秋の名月", hint: "お月見・観月会", months: [9], q: "月見" },
  { key: "koyo", emoji: "🍁", title: "紅葉", hint: "六義園・神宮外苑いちょう並木", months: [10, 11], q: "紅葉" },
  { key: "illumi", emoji: "✨", title: "イルミネーション", hint: "丸の内・恵比寿・表参道", months: [11, 12], q: "イルミネーション" },
];

function jstToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

function isInSeason(cue: Cue, month: number) {
  return cue.months.includes(month);
}

function isUpcoming(cue: Cue, month: number) {
  // 1-2ヶ月先まで「もうすぐ」扱い
  const next1 = ((month % 12) + 1);
  const next2 = ((next1 % 12) + 1);
  return cue.months.includes(next1) || cue.months.includes(next2);
}

function searchHref(cue: Cue) {
  const params = new URLSearchParams();
  if (cue.q) params.set("q", cue.q);
  if (cue.category) params.set("category", cue.category);
  return `/search?${params.toString()}`;
}

async function countMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cue: Cue
): Promise<number> {
  const nowIso = startOfTodayJstIso();
  // 1年先まで
  const yearAhead = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

  let q = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("approved", true)
    .gte("starts_at", nowIso)
    .lt("starts_at", yearAhead);

  if (cue.category) q = q.eq("category", cue.category);
  if (cue.q) {
    const safe = cue.q.replace(/[%,]/g, " ");
    q = q.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  const { count } = await q;
  return count ?? 0;
}

export default async function CalendarPage() {
  const { month } = jstToday();
  const supabase = await createClient();

  // 並列で件数取得
  const counts = await Promise.all(CUES.map((c) => countMatches(supabase, c)));

  const inSeason = CUES.map((c, i) => ({ ...c, count: counts[i] })).filter(
    (c) => isInSeason(c, month)
  );
  const upcoming = CUES.map((c, i) => ({ ...c, count: counts[i] })).filter(
    (c) => !isInSeason(c, month) && isUpcoming(c, month)
  );
  const rest = CUES.map((c, i) => ({ ...c, count: counts[i] })).filter(
    (c) => !isInSeason(c, month) && !isUpcoming(c, month)
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">季節カレンダー</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          東京の「いまの合図」と、もうすぐ来る季節。クリックして探しに行こう。
        </p>
      </header>

      {inSeason.length > 0 && (
        <Section title="🟢 今ちょうど季節" cues={inSeason} accent="ring-2 ring-emerald-400/60" />
      )}
      {upcoming.length > 0 && (
        <Section title="🟡 もうすぐ" cues={upcoming} accent="ring-1 ring-amber-300/60" />
      )}
      <Section title="🗓 一年の季節" cues={rest} />
    </div>
  );
}

function Section({
  title,
  cues,
  accent,
}: {
  title: string;
  cues: (Cue & { count: number })[];
  accent?: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cues.map((c) => (
          <li key={c.key}>
            <Link href={searchHref(c)} className="group block focus:outline-none">
              <Card
                className={`h-full transition-shadow group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring ${accent ?? ""}`}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="text-3xl leading-none">{c.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold leading-snug">{c.title}</h3>
                      {c.count > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {c.count}件
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {c.months.map((m) => `${m}月`).join("・")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
