import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventCategory } from "@/lib/events";
import { formatEventDate } from "@/lib/events";
import { startOfTodayJstIso } from "@/lib/datetime";

export const metadata = { title: "季節カレンダー" };

type Cue = {
  key: string;
  emoji: string;
  title: string;
  hint: string;
  months: number[]; // 1-12
  match: string[]; // events.title/description の ilike に OR でかける具体語
  exclude?: string[]; // title にこれを含むものは除外 (誤マッチ対策)
  category?: EventCategory;
};

// 東京近辺の「季節の合図」。match の各語を title/description に OR 部分一致させ、
// exclude に含む語は除外する。1語ベタ一致だと「梅→青梅市」のような誤マッチが
// 出るため、具体的な複数語 + 除外語で精度を上げている。
const CUES: Cue[] = [
  { key: "hatsumode", emoji: "⛩️", title: "初詣", hint: "新年の参拝・カウントダウン", months: [12, 1], match: ["初詣", "参拝", "カウントダウン"], category: "festival" },
  { key: "setsubun", emoji: "👹", title: "節分・梅まつり", hint: "豆まきと梅の便り", months: [2], match: ["節分", "豆まき", "梅まつり", "梅祭り", "梅園", "観梅"], exclude: ["青梅", "梅田", "梅雨", "松竹梅"] },
  { key: "hina", emoji: "🎎", title: "雛祭り・春の予感", hint: "ひな人形・春のイベント", months: [3], match: ["雛祭り", "ひな祭り", "ひなまつり", "雛人形", "ひな人形"] },
  { key: "sakura", emoji: "🌸", title: "桜・花見", hint: "都内の桜スポット&夜桜", months: [3, 4], match: ["桜", "花見", "夜桜", "さくら"], exclude: ["桜木町", "桜坂", "桜田", "桜新町", "桜上水"], category: "festival" },
  { key: "gw", emoji: "🎏", title: "端午・GWイベント", hint: "こどもの日・大型連休の催し", months: [4, 5], match: ["こいのぼり", "鯉のぼり", "端午", "こどもの日"] },
  { key: "ajisai", emoji: "💠", title: "紫陽花", hint: "梅雨に映えるあじさい名所", months: [5, 6], match: ["紫陽花", "あじさい", "アジサイ"] },
  { key: "tanabata", emoji: "🎋", title: "七夕", hint: "短冊と笹飾り", months: [7], match: ["七夕", "たなばた"], category: "festival" },
  { key: "hanabi", emoji: "🎆", title: "花火大会", hint: "隅田川・神宮外苑・東京湾", months: [7, 8], match: ["花火"], category: "festival" },
  { key: "matsuri", emoji: "🏮", title: "夏祭り・盆踊り", hint: "縁日・盆踊り・神輿", months: [7, 8], match: ["盆踊り", "夏祭り", "縁日", "神輿", "みこし"], category: "festival" },
  { key: "tsukimi", emoji: "🌕", title: "中秋の名月", hint: "お月見・観月会", months: [9], match: ["月見", "観月", "名月", "お月見"], exclude: ["月見ル", "月見そば", "月見うどん", "月見バーガー"] },
  { key: "koyo", emoji: "🍁", title: "紅葉", hint: "六義園・神宮外苑いちょう並木", months: [10, 11], match: ["紅葉", "もみじ", "黄葉", "いちょう祭"] },
  { key: "illumi", emoji: "✨", title: "イルミネーション", hint: "丸の内・恵比寿・表参道", months: [11, 12], match: ["イルミネーション", "イルミ"] },
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
  if (cue.match[0]) params.set("q", cue.match[0]);
  if (cue.category) params.set("category", cue.category);
  return `/search?${params.toString()}`;
}

type CueEvent = { id: string; title: string; starts_at: string | null };

// 各合図にマッチする「これから」のイベントを近い順で取得 (件数 + 先頭3件)
async function matchEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cue: Cue
): Promise<{ count: number; events: CueEvent[] }> {
  const nowIso = startOfTodayJstIso();
  // 1年先まで
  const yearAhead = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

  let q = supabase
    .from("events")
    .select("id, title, starts_at", { count: "exact" })
    .eq("approved", true)
    .gte("starts_at", nowIso)
    .lt("starts_at", yearAhead)
    .order("starts_at", { ascending: true })
    .limit(3);

  if (cue.category) q = q.eq("category", cue.category);

  // 各キーワードを title/description に OR 部分一致
  const ors = cue.match.flatMap((kw) => {
    const safe = kw.replace(/[%,]/g, " ");
    return [`title.ilike.%${safe}%`, `description.ilike.%${safe}%`];
  });
  q = q.or(ors.join(","));

  // 誤マッチ語を title から除外
  for (const ex of cue.exclude ?? []) {
    const safe = ex.replace(/[%,]/g, " ");
    q = q.not("title", "ilike", `%${safe}%`);
  }

  const { data, count } = await q;
  return { count: count ?? 0, events: data ?? [] };
}

export default async function CalendarPage() {
  const { month } = jstToday();
  const supabase = await createClient();

  // 並列で件数 + 先頭イベントを取得
  const matches = await Promise.all(CUES.map((c) => matchEvents(supabase, c)));

  const withData = CUES.map((c, i) => ({
    ...c,
    count: matches[i].count,
    events: matches[i].events,
  }));

  const inSeason = withData.filter((c) => isInSeason(c, month));
  const upcoming = withData.filter(
    (c) => !isInSeason(c, month) && isUpcoming(c, month)
  );
  const rest = withData.filter(
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
  cues: (Cue & { count: number; events: CueEvent[] })[];
  accent?: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cues.map((c) => (
          <li key={c.key}>
            <Card
              className={`h-full transition-shadow hover:shadow-lg ${accent ?? ""}`}
            >
              <CardContent className="flex flex-col gap-3 p-4">
                <Link
                  href={searchHref(c)}
                  className="group flex items-start gap-3 focus:outline-none"
                >
                  <span className="text-3xl leading-none">{c.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold leading-snug group-hover:underline">
                        {c.title}
                      </h3>
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
                </Link>

                {c.events.length > 0 ? (
                  <ul className="space-y-1 border-t pt-2">
                    {c.events.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/events/${e.id}`}
                          className="flex items-baseline gap-2 text-xs hover:text-foreground focus:outline-none"
                        >
                          {e.starts_at && (
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatEventDate(e.starts_at).replace(/^\d+年/, "")}
                            </span>
                          )}
                          <span className="truncate text-foreground/90 hover:underline">
                            {e.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {c.count > c.events.length && (
                      <li>
                        <Link
                          href={searchHref(c)}
                          className="text-[11px] text-muted-foreground hover:underline"
                        >
                          ほか{c.count - c.events.length}件を見る →
                        </Link>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="border-t pt-2 text-[11px] text-muted-foreground/70">
                    いまは登録なし。シーズンになると増えていきます。
                  </p>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
