// URL を1本渡すと、その公式ページから イベント情報を抽出する共通部品。
// - 第一情報源: JSON-LD の schema.org/Event (name / startDate / endDate / location / image / description / offers)
// - フォールバック: OGP / Twitter Card (og:title, og:image, og:description) と <title>
// 取れなかった項目は null。フォーム自動入力 (ユーザー投稿・管理画面の両方) で共有して使う。

import { inferCategory, type EventCategory } from "@/lib/events";

const USER_AGENT = "CueBot/1.0 (+https://cue-taupe-eight.vercel.app)";

export type ExtractedEvent = {
  title: string | null;
  description: string | null;
  // タイトル・説明から推定したカテゴリー (確信度低、人が確認する前提)。取れなければ null。
  category: EventCategory | null;
  // datetime-local 用の "YYYY-MM-DDTHH:mm" (JST 壁時計)。フォームにそのまま入る形。
  startsAt: string | null;
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
  coverImageUrl: string | null;
  ticketUrl: string | null;
  isFree: boolean | null;
};

export type ExtractResult =
  | { ok: true; data: ExtractedEvent }
  | { ok: false; error: string };

const EMPTY: ExtractedEvent = {
  title: null,
  description: null,
  category: null,
  startsAt: null,
  endsAt: null,
  venueName: null,
  address: null,
  coverImageUrl: null,
  ticketUrl: null,
  isFree: null,
};

// 公式ページを fetch して 256KB まで読む。JSON-LD は body 中ほどに置かれることもあるので
// og 取得 (64KB) より多めに読む。タイムアウト 6秒。
export async function extractEventFromUrl(pageUrl: string): Promise<ExtractResult> {
  let target: URL;
  try {
    target = new URL(pageUrl);
  } catch {
    return { ok: false, error: "URL の形式が正しくありません。" };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ok: false, error: "http(s):// から始まる URL を入力してください。" };
  }

  let html: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(target.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, error: `ページを取得できませんでした (HTTP ${res.status})。` };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("xhtml")) {
      return { ok: false, error: "HTML ページではないため情報を取得できませんでした。" };
    }

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: "ページの読み込みに失敗しました。" };
    const decoder = new TextDecoder("utf-8");
    html = "";
    const MAX = 256 * 1024;
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
  } catch {
    return { ok: false, error: "ページの取得に失敗しました (タイムアウト等)。" };
  }

  const data: ExtractedEvent = { ...EMPTY };

  // 1) JSON-LD Event から拾う
  const ld = extractEventLd(html);
  if (ld) {
    data.title = cleanText(strOf(ld.name)) ?? data.title;
    data.description = cleanText(strOf(ld.description)) ?? data.description;
    data.startsAt = toJstLocal(strOf(ld.startDate)) ?? data.startsAt;
    data.endsAt = toJstLocal(strOf(ld.endDate)) ?? data.endsAt;

    const loc = pickLocation(ld.location);
    if (loc.venueName) data.venueName = cleanText(loc.venueName);
    if (loc.address) data.address = cleanText(loc.address);

    const img = pickImage(ld.image);
    if (img) data.coverImageUrl = absUrl(img, target);

    const offers = pickOffers(ld.offers);
    if (offers.ticketUrl) data.ticketUrl = absUrl(offers.ticketUrl, target);
    if (offers.isFree !== null) data.isFree = offers.isFree;
  }

  // 2) OGP / Twitter / <title> でフォールバック
  if (!data.title) {
    data.title =
      cleanText(matchMeta(html, "og:title")) ??
      cleanText(matchTitleTag(html)) ??
      data.title;
  }
  if (!data.description) {
    data.description =
      cleanText(matchMeta(html, "og:description")) ??
      cleanText(matchMeta(html, "description")) ??
      data.description;
  }
  if (!data.coverImageUrl) {
    const og =
      matchMeta(html, "og:image") ??
      matchMeta(html, "twitter:image") ??
      matchMeta(html, "twitter:image:src");
    if (og) data.coverImageUrl = absUrl(og, target);
  }

  // タイトル + 説明 + 会場からカテゴリーを推定 (取れた範囲で)
  data.category = inferCategory(
    [data.title, data.venueName, data.description].filter(Boolean).join(" ")
  );

  const anyFound =
    data.title ||
    data.description ||
    data.startsAt ||
    data.coverImageUrl ||
    data.venueName ||
    data.address;
  if (!anyFound) {
    return {
      ok: false,
      error: "このページからイベント情報を読み取れませんでした。手入力してください。",
    };
  }

  return { ok: true, data };
}

// ---- JSON-LD ----

type LdEvent = {
  name?: unknown;
  description?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  location?: unknown;
  image?: unknown;
  offers?: unknown;
};

// HTML 内の全 JSON-LD ブロックを走査し、最初に見つかった Event オブジェクトを返す。
// @graph 配列や型配列もたどる。
function extractEventLd(html: string): LdEvent | null {
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let json: unknown;
    try {
      json = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const found = findEventNode(json, 0);
    if (found) return found;
  }
  return null;
}

function findEventNode(node: unknown, depth: number): LdEvent | null {
  if (depth > 6 || node == null) return null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const f = findEventNode(v, depth + 1);
      if (f) return f;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (isEventType(obj["@type"])) return obj as LdEvent;
  // @graph などネストをたどる
  for (const key of ["@graph", "mainEntity", "subEvent"]) {
    if (key in obj) {
      const f = findEventNode(obj[key], depth + 1);
      if (f) return f;
    }
  }
  return null;
}

function isEventType(t: unknown): boolean {
  const matchOne = (s: string) => /event/i.test(s);
  if (typeof t === "string") return matchOne(t);
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && matchOne(x));
  return false;
}

// location: Place オブジェクト / 文字列 / 配列 から会場名と住所を拾う。
function pickLocation(loc: unknown): { venueName: string | null; address: string | null } {
  const out = { venueName: null as string | null, address: null as string | null };
  const first = Array.isArray(loc) ? loc[0] : loc;
  if (first == null) return out;
  if (typeof first === "string") {
    out.venueName = first;
    return out;
  }
  if (typeof first !== "object") return out;
  const obj = first as Record<string, unknown>;
  out.venueName = strOf(obj.name);
  out.address = formatAddress(obj.address);
  return out;
}

function formatAddress(addr: unknown): string | null {
  if (addr == null) return null;
  if (typeof addr === "string") return addr;
  if (typeof addr !== "object") return null;
  const a = addr as Record<string, unknown>;
  const parts = [
    a.postalCode,
    a.addressRegion,
    a.addressLocality,
    a.streetAddress,
  ]
    .map((p) => strOf(p))
    .filter((p): p is string => !!p);
  return parts.length ? parts.join(" ") : null;
}

function pickImage(image: unknown): string | null {
  const first = Array.isArray(image) ? image[0] : image;
  if (first == null) return null;
  if (typeof first === "string") return first;
  if (typeof first === "object") {
    return strOf((first as Record<string, unknown>).url);
  }
  return null;
}

// offers: Offer / 配列 から チケット URL と無料判定を拾う。
function pickOffers(offers: unknown): { ticketUrl: string | null; isFree: boolean | null } {
  const out = { ticketUrl: null as string | null, isFree: null as boolean | null };
  const list = Array.isArray(offers) ? offers : offers == null ? [] : [offers];
  for (const o of list) {
    if (o == null || typeof o !== "object") continue;
    const obj = o as Record<string, unknown>;
    if (!out.ticketUrl) {
      const url = strOf(obj.url);
      if (url) out.ticketUrl = url;
    }
    const price = obj.price ?? obj.lowPrice;
    if (out.isFree === null && price != null) {
      const n = typeof price === "number" ? price : Number(String(price).replace(/[, ]/g, ""));
      if (!Number.isNaN(n)) out.isFree = n === 0;
    }
  }
  return out;
}

// ---- 日時変換 ----

// schema.org の日時 → datetime-local 用 "YYYY-MM-DDTHH:mm" (JST 壁時計)。
// タイムゾーン付き (Z / +09:00 等) なら Asia/Tokyo に変換。無ければ既に JST 壁時計とみなし先頭を採用。
function toJstLocal(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const hasTz = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  if (!hasTz) {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return null;
    const [, y, mo, d, hh = "00", mm = "00"] = m;
    return `${y}-${mo}-${d}T${hh}:${mm}`;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

// ---- 文字列ヘルパー ----

function strOf(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

function cleanText(v: string | null): string | null {
  if (!v) return null;
  const t = decodeEntities(v).replace(/\s+/g, " ").trim();
  return t || null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

function absUrl(url: string, base: URL): string | null {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function matchTitleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.trim() || null;
}

function matchMeta(html: string, prop: string): string | null {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}
