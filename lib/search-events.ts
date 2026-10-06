// イベント検索の本体。
//
// もともと DB 側の search_events / search_event_facets (RPC) に任せていたが、
// 会場名・エリア・住所まで検索対象に広げたかったのと、常設イベントが日付フィルタで
// 消えてしまう不具合があったため、アプリ側で絞り込むようにした。
// 公開中のイベントは数百件規模なので、必要な行をまとめて取ってから JS で絞り込む。
//
// DB 任せだった頃に比べて、こちらの方が良くなっている点:
//   - 会場名 / エリア / 住所もキーワードの対象 (「新宿」で新宿の会場のイベントが出る)
//   - 全角半角・大文字小文字・カタカナひらがなの違いを吸収する
//   - 常設イベントは日付フィルタで落とさない

import type { SupabaseClient } from "@supabase/supabase-js";
import { jstParts } from "@/lib/datetime";
import type { EventCategory } from "@/lib/events";

// 検索・表示に必要な列。説明と住所はキーワード照合のために取る。
export const SEARCH_SELECT =
  "id, title, starts_at, ends_at, is_permanent, venue_name, area, address, description, category, cover_image_url, has_food_stalls, created_at, event_tags(tags(slug))";

type TagJoin = { tags: { slug: string } | null };

export type SearchableEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  is_permanent: boolean | null;
  venue_name: string | null;
  area: string | null;
  address: string | null;
  description: string | null;
  category: EventCategory;
  cover_image_url: string | null;
  has_food_stalls: boolean | null;
  created_at: string;
  event_tags: TagJoin[];
};

function tagSlugs(e: SearchableEvent): string[] {
  return (e.event_tags ?? [])
    .map((t) => t.tags?.slug)
    .filter((s): s is string => !!s);
}

export type SearchSort = "soon" | "new" | "relevant";

export type SearchQuery = {
  q: string;
  categories: string[];
  areas: string[];
  /** タグの slug。複数指定したときは「すべて満たす」で絞る */
  tags: string[];
  dateFrom: string;
  dateTo: string | null;
  freeOnly: boolean;
  eveningOnly: boolean;
  foodStalls: boolean;
  sort: SearchSort;
};

export type SearchFacets = {
  categories: Record<string, number>;
  areas: Record<string, number>;
  tags: Record<string, number>;
};

// 1回の検索で DB から読む上限。公開イベントの総数より十分大きくしておく。
const FETCH_CAP = 1000;

// 「夜」とみなす開始時刻 (JST)
const EVENING_FROM_HOUR = 18;

// 表記ゆれを吸収する。
//   - NFKC: 全角英数や全角スペースを半角に寄せる
//   - toLowerCase: 大文字小文字の違いを無視する
//   - カタカナ→ひらがな: 「チームラボ」と「ちーむらぼ」を同じ扱いにする
function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    );
}

/** 検索キーワードを空白区切りのトークンに分解する (正規化済み) */
export function searchTokens(q: string): string[] {
  return normalize(q).split(/\s+/).filter(Boolean);
}

// キーワード照合の対象テキスト。タイトル・説明に加えて場所の情報も含める。
function haystack(e: SearchableEvent): string {
  return normalize(
    [e.title, e.description, e.venue_name, e.area, e.address]
      .filter(Boolean)
      .join(" ")
  );
}

// 場所に関するテキストだけを集めたもの (関連度の重み付けに使う)
function placeText(e: SearchableEvent): string {
  return normalize(
    [e.venue_name, e.area, e.address].filter(Boolean).join(" ")
  );
}

// 何文字の打ち間違いまで許すか。短い語で誤差を許すと無関係な語まで拾うので、
// 3文字以下は完全一致のみとする。
function allowedEdits(token: string): number {
  if (token.length <= 3) return 0;
  if (token.length <= 7) return 1;
  return 2;
}

// token が hay のどこかに、maxEdits 文字以内の違いで現れるか。
// 部分文字列に対する編集距離 (レーベンシュタイン)。各行の先頭を 0 にすると
// 「どこから始まってもよい」= 部分一致の最小コストが求まる。
// 「ハロウイン」→「池袋ハロウィンコスプレフェス」のような1文字違いを拾うため。
function approxContains(
  hay: string,
  token: string,
  maxEdits: number
): boolean {
  const n = token.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let best = n;
  for (let i = 1; i <= hay.length; i++) {
    const cur = new Array<number>(n + 1);
    cur[0] = 0;
    for (let j = 1; j <= n; j++) {
      const cost = hay[i - 1] === token[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    if (cur[n] < best) best = cur[n];
    if (best <= maxEdits) return true;
    prev = cur;
  }
  return best <= maxEdits;
}

// 全トークンが対象テキストに含まれるか (通常の一致)
function matchesAllTokens(e: SearchableEvent, tokens: string[]): boolean {
  const hay = haystack(e);
  return tokens.every((t) => hay.includes(t));
}

// 全トークンが「ほぼ」含まれるか (タイプミス救済)。
// あいまい一致は関係ないイベントまで拾ってしまうので、
// 通常の一致が1件も無かったときの保険としてだけ使う。
function matchesFuzzy(e: SearchableEvent, tokens: string[]): boolean {
  const hay = haystack(e);
  return tokens.every((t) => {
    const edits = allowedEdits(t);
    return edits > 0 && approxContains(hay, t, edits);
  });
}

// 関連度。タイトルに全部入っているものを最優先、次に場所 (会場・エリア・住所)。
function relevance(e: SearchableEvent, tokens: string[]): number {
  const title = normalize(e.title);
  const place = placeText(e);
  let score = 0;
  if (tokens.every((t) => title.includes(t))) score += 100;
  if (place && tokens.every((t) => place.includes(t))) score += 50;
  return score;
}

function isEvening(startsAt: string): boolean {
  return jstParts(new Date(startsAt)).hour >= EVENING_FROM_HOUR;
}

/**
 * 検索を実行して、結果とファセット (カテゴリ別・エリア別の件数) を返す。
 *
 * ファセットはカテゴリ・エリアの絞り込みを掛ける前の件数を数える。
 * (絞り込んだ後だと、選んでいない選択肢の件数が全部 0 になってしまう)
 */
export async function searchEvents(
  supabase: SupabaseClient,
  params: SearchQuery
): Promise<{
  events: SearchableEvent[];
  facets: SearchFacets;
  error: string | null;
}> {
  // DB 側で効率よく絞れる条件 (承認済み・日付・無料・屋台) だけ先に適用する。
  // 常設イベントは毎日やっているので、日付の範囲外でも残す。
  const within = params.dateTo
    ? `and(starts_at.gte.${params.dateFrom},starts_at.lte.${params.dateTo})`
    : `starts_at.gte.${params.dateFrom}`;

  let query = supabase
    .from("events")
    .select(SEARCH_SELECT)
    .eq("approved", true)
    .or(`${within},is_permanent.is.true`);

  if (params.freeOnly) query = query.eq("is_free", true);
  if (params.foodStalls) query = query.eq("has_food_stalls", true);

  const { data, error } = await query.limit(FETCH_CAP);
  if (error) {
    return {
      events: [],
      facets: { categories: {}, areas: {}, tags: {} },
      error: error.message,
    };
  }
  const rows = (data ?? []) as unknown as SearchableEvent[];

  const tokens = searchTokens(params.q);

  // キーワード・夜だけ条件で絞る (ここまでがファセットの母集団)
  const evening = params.eveningOnly
    ? rows.filter((e) => isEvening(e.starts_at))
    : rows;

  let base = tokens.length === 0
    ? evening
    : evening.filter((e) => matchesAllTokens(e, tokens));
  if (tokens.length > 0 && base.length === 0) {
    base = evening.filter((e) => matchesFuzzy(e, tokens));
  }

  const facets: SearchFacets = { categories: {}, areas: {}, tags: {} };
  for (const e of base) {
    facets.categories[e.category] = (facets.categories[e.category] ?? 0) + 1;
    if (e.area) facets.areas[e.area] = (facets.areas[e.area] ?? 0) + 1;
    for (const slug of tagSlugs(e)) {
      facets.tags[slug] = (facets.tags[slug] ?? 0) + 1;
    }
  }

  // カテゴリ・エリア・タグの絞り込み
  const categorySet = new Set(params.categories);
  const areaSet = new Set(params.areas);
  const events = base.filter((e) => {
    if (categorySet.size > 0 && !categorySet.has(e.category)) return false;
    if (areaSet.size > 0 && (e.area === null || !areaSet.has(e.area))) {
      return false;
    }
    if (params.tags.length > 0) {
      const slugs = new Set(tagSlugs(e));
      if (!params.tags.every((t) => slugs.has(t))) return false;
    }
    return true;
  });

  events.sort((a, b) => {
    if (params.sort === "new") return b.created_at.localeCompare(a.created_at);
    if (params.sort === "relevant" && tokens.length > 0) {
      const diff = relevance(b, tokens) - relevance(a, tokens);
      if (diff !== 0) return diff;
    }
    return a.starts_at.localeCompare(b.starts_at);
  });

  return { events, facets, error: null };
}
