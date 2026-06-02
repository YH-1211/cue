// 外部フィード取り込みヘルパー
// - RSS / Atom: rss-parser 経由
// - target_table で events / news_items に振り分け
// - 将来 JSON / iCal を追加可能

import Parser from "rss-parser";
// node-ical はトップレベルで読み込むとビルド時 (page data 収集) に
// 依存先が落ちるため、ingestICal 内で動的 import する。型のみここで取り込む。
import type ICal from "node-ical";
import type { EventCategory } from "@/lib/events";
import type { createAdminClient } from "@/utils/supabase/admin";

export type IngestSource = {
  id: string;
  name: string;
  kind: "rss" | "atom" | "ical" | "json";
  url: string;
  category_default: EventCategory;
  area_default: string | null;
  enabled: boolean;
  auto_approve: boolean;
  include_pattern: string | null;
  exclude_pattern: string | null;
  target_table: "events" | "news_items";
};

type Admin = ReturnType<typeof createAdminClient>;

const USER_AGENT = "CueBot/1.0 (+https://cue-taupe-eight.vercel.app)";

export async function ingestSource(admin: Admin, src: IngestSource): Promise<number> {
  switch (src.kind) {
    case "rss":
    case "atom":
      return ingestFeed(admin, src);
    case "ical":
      return ingestICal(admin, src);
    case "json":
      // 将来実装。現状は no-op で 0 件扱い。
      throw new Error(`kind "${src.kind}" は未実装です`);
    default:
      throw new Error(`unknown kind: ${src.kind}`);
  }
}

async function ingestFeed(admin: Admin, src: IngestSource): Promise<number> {
  const parser = new Parser({
    timeout: 15000,
    headers: { "User-Agent": USER_AGENT },
  });

  const feed = await parser.parseURL(src.url);
  const items = feed.items ?? [];

  // フィルタ用正規表現 (大文字小文字無視)
  const includeRe = src.include_pattern ? safeRegex(src.include_pattern) : null;
  const excludeRe = src.exclude_pattern ? safeRegex(src.exclude_pattern) : null;

  let upserted = 0;
  for (const item of items) {
    const link = item.link?.trim();
    const title = item.title?.trim();
    if (!link || !title) continue;

    // キーワードフィルタ
    if (excludeRe && excludeRe.test(title)) continue;
    if (includeRe && !includeRe.test(title)) continue;

    const isoDate = item.isoDate ?? null;
    if (!isoDate) continue;

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) continue;

    // 過去90日より古いものは無視 (news 側でも 30日 purge があるが先に弾く)
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    if (date.getTime() < cutoff) continue;

    if (src.target_table === "news_items") {
      const ok = await upsertNews(admin, src, item, title, link, date);
      if (ok) upserted += 1;
    } else {
      const ok = await upsertEvent(admin, src, item, title, link, date);
      if (ok) upserted += 1;
    }
  }
  return upserted;
}

// =====================================================
// iCal (.ics) 取り込み
// VEVENT の DTSTART を「開催日時」として扱う。記事フィードと違い構造化された
// 開催日が取れるので events 向き。RRULE (繰り返し) は node-ical の
// expandRecurringEvent で今後1年分の発生回に展開する。
// =====================================================
const ICAL_HORIZON_DAYS = 365;
const ICAL_PAST_GRACE_MS = 24 * 60 * 60 * 1000; // 開催中/当日扱いとして過去1日まで許容

// ParameterValue (string | {val} | {params}) を素の文字列に均す
function icalText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "val" in v) {
    const val = (v as { val?: unknown }).val;
    return typeof val === "string" ? val : "";
  }
  return "";
}

async function ingestICal(admin: Admin, src: IngestSource): Promise<number> {
  // events 専用 (news_items には開催日の概念が無いため非対応)
  if (src.target_table !== "events") {
    throw new Error("ical ソースは target_table=events のみ対応です");
  }

  const ical = (await import("node-ical")).default;

  // options 付き fromURL は callback オーバーロード扱いで戻り型が void になるため
  // Promise<CalendarResponse> を明示する
  const data = (await (
    ical.async.fromURL as (
      url: string,
      options: { headers: Record<string, string> }
    ) => Promise<ICal.CalendarResponse>
  )(src.url, { headers: { "User-Agent": USER_AGENT } }));

  const includeRe = src.include_pattern ? safeRegex(src.include_pattern) : null;
  const excludeRe = src.exclude_pattern ? safeRegex(src.exclude_pattern) : null;

  const now = Date.now();
  const from = new Date(now - ICAL_PAST_GRACE_MS);
  const to = new Date(now + ICAL_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  // (title, start, end) を集めてから upsert。重複 (同 uid + 同開催日) は除く。
  type Occurrence = {
    sourceId: string;
    title: string;
    description: string | null;
    startsAt: Date;
    endsAt: Date | null;
    venue: string | null;
    url: string | null;
  };
  const occurrences: Occurrence[] = [];
  const seen = new Set<string>();

  for (const key of Object.keys(data)) {
    const comp = data[key];
    if (!comp || comp.type !== "VEVENT") continue;
    const ev = comp as ICal.VEvent;

    const title = icalText(ev.summary).trim();
    if (!title) continue;
    if (excludeRe && excludeRe.test(title)) continue;
    if (includeRe && !includeRe.test(title)) continue;

    const description = icalText(ev.description).slice(0, 2000) || null;
    const venue = icalText(ev.location).trim() || null;
    const url = icalText((ev as { url?: unknown }).url).trim() || null;

    // 発生回を列挙 (繰り返しは展開、単発はそのまま1件)
    const instances: { start: Date; end: Date | null }[] = [];
    if (ev.rrule) {
      try {
        for (const inst of ical.expandRecurringEvent(ev, { from, to })) {
          instances.push({
            start: new Date(inst.start),
            end: inst.end ? new Date(inst.end) : null,
          });
        }
      } catch {
        // 展開失敗時はベースの開始日だけ拾う
        if (ev.start) instances.push({ start: new Date(ev.start), end: ev.end ? new Date(ev.end) : null });
      }
    } else if (ev.start) {
      instances.push({ start: new Date(ev.start), end: ev.end ? new Date(ev.end) : null });
    }

    for (const { start, end } of instances) {
      if (Number.isNaN(start.getTime())) continue;
      if (start.getTime() < from.getTime() || start.getTime() > to.getTime()) continue;
      // 繰り返しは uid だけだと衝突するので開催日時を付ける
      const baseId = ev.uid || url || `${src.id}:${title}`;
      const sourceId = ev.rrule ? `${baseId}@${start.toISOString()}` : baseId;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      occurrences.push({ sourceId, title, description, startsAt: start, endsAt: end, venue, url });
    }
  }

  let upserted = 0;
  for (const occ of occurrences) {
    const row = {
      title: occ.title.slice(0, 500),
      description: occ.description,
      starts_at: occ.startsAt.toISOString(),
      ends_at: occ.endsAt ? occ.endsAt.toISOString() : null,
      venue_name: occ.venue,
      official_url: occ.url,
      category: src.category_default,
      area: src.area_default,
      source_type: "ical" as const,
      source_id: occ.sourceId,
      approved: src.auto_approve,
    };
    const { error } = await admin
      .from("events")
      .upsert(row, { onConflict: "source_type,source_id", ignoreDuplicates: false });
    if (error) {
      console.warn(`[ingest:ical] upsert failed: ${src.name} / ${occ.sourceId}`, error.message);
      continue;
    }
    upserted += 1;
  }
  return upserted;
}

type FeedItem = Parser.Item & { content?: string };

async function upsertEvent(
  admin: Admin,
  src: IngestSource,
  item: FeedItem,
  title: string,
  link: string,
  startsAt: Date
): Promise<boolean> {
  // 既存レコードを確認。ticket_url がまだ無いときだけ fetch を試みる (upsertNews と同じ方針)。
  const { data: existing } = await admin
    .from("events")
    .select("id, ticket_url")
    .eq("source_type", "rss")
    .eq("source_id", link)
    .maybeSingle();

  let ticketUrl: string | null = existing?.ticket_url ?? null;
  if (!ticketUrl) {
    ticketUrl = await fetchTicketUrl(link);
  }

  const row = {
    title: title.slice(0, 500),
    description: (item.contentSnippet ?? "").slice(0, 2000) || null,
    starts_at: startsAt.toISOString(),
    official_url: link,
    category: src.category_default,
    area: src.area_default,
    source_type: "rss" as const,
    source_id: link,
    approved: src.auto_approve,
    ticket_url: ticketUrl,
  };

  const { error } = await admin
    .from("events")
    .upsert(row, { onConflict: "source_type,source_id", ignoreDuplicates: false });

  if (error) {
    console.warn(`[ingest:events] upsert failed: ${src.name} / ${link}`, error.message);
    return false;
  }
  return true;
}

async function upsertNews(
  admin: Admin,
  src: IngestSource,
  item: FeedItem,
  title: string,
  link: string,
  publishedAt: Date
): Promise<boolean> {
  // 既存レコードをチェック。既に image_url がある = 何もしない。OGP fetch を避けるため。
  const { data: existing } = await admin
    .from("news_items")
    .select("id, image_url")
    .eq("source_type", "rss")
    .eq("source_id", link)
    .maybeSingle();

  if (existing?.image_url) return false;

  // 画像取得: RSS content から → OGP fetch
  let imageUrl: string | null = extractImage(item);
  if (!imageUrl) {
    imageUrl = await fetchOgImage(link);
  }

  if (existing) {
    // 既存だが画像がなかった → image_url だけ更新
    if (imageUrl) {
      await admin
        .from("news_items")
        .update({ image_url: imageUrl })
        .eq("id", existing.id);
    }
    return false;
  }

  const row = {
    title: title.slice(0, 500),
    summary: (item.contentSnippet ?? "").slice(0, 500) || null,
    source_name: src.name.replace(/\s*\(.+\)\s*$/, ""), // "音楽ナタリー (試験)" → "音楽ナタリー"
    source_url: link,
    category: src.category_default,
    image_url: imageUrl,
    published_at: publishedAt.toISOString(),
    source_type: "rss" as const,
    source_id: link,
  };

  const { error } = await admin
    .from("news_items")
    .upsert(row, { onConflict: "source_type,source_id", ignoreDuplicates: false });

  if (error) {
    console.warn(`[ingest:news] upsert failed: ${src.name} / ${link}`, error.message);
    return false;
  }
  return true;
}

// content / content:encoded から <img src="..."> を抜く簡易抽出
function extractImage(item: FeedItem): string | null {
  const html = item.content ?? "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

// 記事 URL を fetch して og:image / twitter:image を抜く。タイムアウト 4秒。
async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("xhtml")) return null;

    // head の先頭 64KB だけで充分 (og タグは通常 head の早い段階)
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder("utf-8");
    let html = "";
    const MAX = 64 * 1024;
    while (html.length < MAX) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes("</head>")) break;
    }
    try {
      await reader.cancel();
    } catch {
      // ignore
    }

    const found =
      matchMeta(html, "og:image") ??
      matchMeta(html, "twitter:image") ??
      matchMeta(html, "twitter:image:src");
    if (!found) return null;

    // 相対 URL を絶対 URL に
    try {
      return new URL(found, pageUrl).toString();
    } catch {
      return null;
    }
  } catch {
    // タイムアウト / DNS / 接続失敗等は静かに諦める
    return null;
  }
}

function matchMeta(html: string, prop: string): string | null {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // property="og:image" content="..." または content=".." property=".." 両対応
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

// 公式ページを fetch して、チケット販売/予約ページへのリンクを探す。タイムアウト 4秒。
// 検出ルール:
//   - href が ticket / 主要プレイガイド (tixee, t.pia.jp, eplus.jp, peatix.com, connpass.com/event/, eventbrite, tiget, passmarket) を含む
//   - リンクテキストが「チケット」「予約」「申込」「購入」「お申し込み」を含む
//   - 同一オリジンへのリンクは原則スキップ。ただし path に "ticket" を含む場合は内部チケットページとして許可。
const TICKET_HREF_PATTERNS = [
  "ticket",
  "tixee",
  "t.pia.jp",
  "eplus.jp",
  "peatix.com",
  "connpass.com/event/",
  "eventbrite",
  "tiget",
  "passmarket",
];
const TICKET_TEXT_KEYWORDS = [
  "チケット",
  "予約",
  "申込",
  "購入",
  "チケット購入",
  "お申し込み",
];

async function fetchTicketUrl(pageUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("xhtml")) return null;

    // チケットリンクは body 中段以降にあることも多いので og 取得より少し多めに 128KB 読む
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder("utf-8");
    let html = "";
    const MAX = 128 * 1024;
    while (html.length < MAX) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    try {
      await reader.cancel();
    } catch {
      // ignore
    }

    let baseOrigin: string;
    try {
      baseOrigin = new URL(pageUrl).origin;
    } catch {
      return null;
    }

    // <a ...href="..."...>text</a> を網羅 (シンプルな正規表現でグローバルにスキャン)
    const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(html)) !== null) {
      const attrs = m[1] ?? "";
      const inner = m[2] ?? "";
      const hrefMatch =
        attrs.match(/\bhref\s*=\s*"([^"]+)"/i) ??
        attrs.match(/\bhref\s*=\s*'([^']+)'/i);
      if (!hrefMatch) continue;
      const rawHref = hrefMatch[1].trim();
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) continue;

      // 相対 URL を絶対 URL に解決
      let abs: URL;
      try {
        abs = new URL(rawHref, pageUrl);
      } catch {
        continue;
      }
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;

      const absStr = abs.toString();
      const lowerHref = absStr.toLowerCase();
      // テキスト部のタグを除去 + 連続空白を畳む
      const textOnly = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const hrefHit = TICKET_HREF_PATTERNS.some((p) => lowerHref.includes(p));
      const textHit = TICKET_TEXT_KEYWORDS.some((k) => textOnly.includes(k));
      if (!hrefHit && !textHit) continue;

      // 同一オリジンは原則スキップ。ただし path に "ticket" を含むなら内部チケットページとして許可。
      const sameOrigin = abs.origin === baseOrigin;
      if (sameOrigin && !abs.pathname.toLowerCase().includes("ticket")) {
        continue;
      }

      return absStr;
    }

    return null;
  } catch {
    // タイムアウト / 接続失敗等は静かに諦める
    return null;
  }
}

// 不正パターンが来てもクラッシュさせない
function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch (e) {
    console.warn(`[ingest] invalid regex: ${pattern}`, e);
    return null;
  }
}
