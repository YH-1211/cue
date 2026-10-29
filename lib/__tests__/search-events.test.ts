import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchEvents } from "@/lib/search-events";

// searchEvents が DB に投げるフィルタ文字列を捕まえるだけの偽クライアント。
// 実際の通信はせず、渡した rows をそのまま返す。
function fakeSupabase(rows: unknown[]) {
  const calls: { or?: string } = {};
  const query = {
    select: () => query,
    eq: () => query,
    or: (expr: string) => {
      calls.or = expr;
      return query;
    },
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  const client = { from: () => query } as unknown as SupabaseClient;
  return { client, calls };
}

const baseQuery = {
  q: "",
  categories: [],
  areas: [],
  tags: [],
  dateFrom: "2026-10-28T15:00:00.000Z",
  dateTo: null,
  freeOnly: false,
  eveningOnly: false,
  foodStalls: false,
  sort: "soon" as const,
};

// 先週始まって今も開催中のイベント (これが漏れていた)
const ongoing = {
  id: "1",
  title: "第66回 東京名物 神田古本まつり",
  starts_at: "2026-10-22T15:00:00.000Z",
  ends_at: "2026-11-01T15:00:00.000Z",
  is_permanent: false,
  venue_name: "神田神保町古書店街",
  area: "千代田",
  address: null,
  description: null,
  category: "learning",
  cover_image_url: null,
  has_food_stalls: false,
  created_at: "2026-10-01T00:00:00.000Z",
  event_tags: [],
};

describe("searchEvents の日付フィルタ", () => {
  // 回帰テスト: 開始日で絞ると、会期の長い展覧会・映画祭・まつりが
  // 「開催中なのに検索に出ない」状態になる (2026-10-28 に修正)。
  it("開始日ではなく会期の終わり (effective_end) で絞る", async () => {
    const { client, calls } = fakeSupabase([ongoing]);
    await searchEvents(client, baseQuery);

    expect(calls.or).toContain(`effective_end.gte.${baseQuery.dateFrom}`);
    expect(calls.or).not.toContain(`starts_at.gte.`);
  });

  it("期間を区切るときも開始側は effective_end で見る", async () => {
    const { client, calls } = fakeSupabase([ongoing]);
    await searchEvents(client, {
      ...baseQuery,
      dateTo: "2026-11-30T15:00:00.000Z",
    });

    // 「会期が範囲と重なる」= 終わりが範囲の後 かつ 始まりが範囲の前
    expect(calls.or).toContain(`effective_end.gte.${baseQuery.dateFrom}`);
    expect(calls.or).toContain("starts_at.lte.2026-11-30T15:00:00.000Z");
  });

  it("常設イベントは日付の範囲外でも残す", async () => {
    const { client, calls } = fakeSupabase([ongoing]);
    await searchEvents(client, baseQuery);

    expect(calls.or).toContain("is_permanent.is.true");
  });

  it("開催中のイベントがキーワードで見つかる", async () => {
    const { client } = fakeSupabase([ongoing]);
    const { events } = await searchEvents(client, {
      ...baseQuery,
      q: "古本",
    });

    expect(events.map((e) => e.title)).toEqual([
      "第66回 東京名物 神田古本まつり",
    ]);
  });
});
