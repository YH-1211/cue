// エリア別 / カテゴリ別 / 月別のランディングページで使う共通ヘルパー。
//
// 狙い: 検索の受け皿を「個別イベントページ」以外にも作ること。
// 個別ページは開催が終わると検索需要ごと消えるので、
// 「11月 東京 イベント」「渋谷 イルミネーション」のような
// 毎年・毎月くり返される一般クエリを受け止めるページが必要になる。

import {
  AREAS_BY_PREFECTURE,
  PREFECTURES,
  type Prefecture,
} from "@/lib/tokyo-areas";
import { jstDateToUtc, jstParts, startOfTodayJstIso } from "@/lib/datetime";

/* ------------------------------------------------------------------ *
 * エリア
 * ------------------------------------------------------------------ */

// エリア名に付ける行政単位。見出しや title に使う。
// 「渋谷区」「横浜市」「箱根町」のように正しく出し分けるため、
// 一律に「区」を付けないこと (横浜区・さいたま区になってしまう)。
const AREA_SUFFIX: Record<string, string> = {
  // 東京23区
  千代田: "区", 中央: "区", 港: "区", 新宿: "区", 文京: "区",
  台東: "区", 墨田: "区", 江東: "区", 品川: "区", 目黒: "区",
  大田: "区", 世田谷: "区", 渋谷: "区", 中野: "区", 杉並: "区",
  豊島: "区", 北: "区", 荒川: "区", 板橋: "区", 練馬: "区",
  足立: "区", 葛飾: "区", 江戸川: "区",
  // 東京市部
  八王子: "市", 立川: "市", 武蔵野: "市", 府中: "市", 調布: "市",
  町田: "市", 日野: "市", 青梅: "市", 武蔵村山: "市", 稲城: "市",
  // 神奈川
  横浜: "市", 川崎: "市", 鎌倉: "市", 藤沢: "市", 横須賀: "市",
  相模原: "市", 箱根: "町",
  // 埼玉
  さいたま: "市", 川越: "市", 所沢: "市", 川口: "市", 越谷: "市", 秩父: "市",
  // 千葉 (幕張は行政区画ではない地名なので付けない)
  千葉: "市", 船橋: "市", 市川: "市", 柏: "市", 浦安: "市",
  成田: "市", 木更津: "市",
};

// 「渋谷」→「渋谷区」。未知のエリアはそのまま返す。
export function areaLabel(area: string): string {
  return area + (AREA_SUFFIX[area] ?? "");
}

// 全エリア名をフラットに (宣言順 = 都県順)
export const ALL_AREAS: string[] = PREFECTURES.flatMap((p) =>
  Object.keys(AREAS_BY_PREFECTURE[p]),
);

export function isKnownArea(area: string): boolean {
  return ALL_AREAS.includes(area);
}

// そのエリアが属する都県を返す
export function prefectureOfArea(area: string): Prefecture | null {
  for (const p of PREFECTURES) {
    if (area in AREAS_BY_PREFECTURE[p]) return p;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 月
 * ------------------------------------------------------------------ */

export type MonthSlug = { year: number; month: number }; // month は 1 始まり

// "2026-11" → { year: 2026, month: 11 }。不正なら null。
export function parseMonthSlug(slug: string): MonthSlug | null {
  const m = /^(\d{4})-(\d{2})$/.exec(slug);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  // 過去や遠い未来のページを無限に生やさない (クローラが迷子になる)
  if (year < 2020 || year > 2100) return null;
  return { year, month };
}

export function monthSlugOf({ year, month }: MonthSlug): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// その月の開始/終了を UTC の ISO 文字列で返す (JST の月境界)
export function monthRangeIso({ year, month }: MonthSlug): {
  start: string;
  end: string; // 翌月 1 日 0:00 JST (この値「未満」が対象)
} {
  return {
    start: jstDateToUtc(year, month - 1, 1, 0).toISOString(),
    end: jstDateToUtc(year, month, 1, 0).toISOString(),
  };
}

// 今月から count か月分のスラッグ一覧 (ハブページと sitemap 用)
export function upcomingMonths(count: number, now: Date = new Date()): MonthSlug[] {
  const { year, month } = jstParts(now); // month は 0 始まり
  const out: MonthSlug[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(year, month + i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

export function monthLabel({ year, month }: MonthSlug): string {
  return `${year}年${month}月`;
}

/* ------------------------------------------------------------------ *
 * 一覧ページ共通のクエリ条件
 * ------------------------------------------------------------------ */

// 一覧カードに必要な列。ページ間でズレないよう1か所にまとめる。
export const EVENT_LIST_COLUMNS =
  "id, title, starts_at, ends_at, venue_name, area, category, cover_image_url, has_food_stalls, is_permanent";

// 掲載中 (承認済み・未終了) のカットオフ
export function listCutoffIso(now: Date = new Date()): string {
  return startOfTodayJstIso(now);
}

// URL セグメントの日本語を安全にデコードする。
// Next.js は多くの場合デコード済みの値をくれるが、二重に通しても
// 日本語はそのまま返るので問題ない。壊れた % 列だけ握りつぶす。
export function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
