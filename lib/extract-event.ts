// URL を1本渡すと、その公式ページから イベント情報を抽出する共通部品。
// - 第一情報源: JSON-LD の schema.org/Event (name / startDate / endDate / location / image / description / offers)
// - フォールバック: OGP / Twitter Card (og:title, og:image, og:description) と <title>
// 取れなかった項目は null。フォーム自動入力 (ユーザー投稿・管理画面の両方) で共有して使う。

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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
    let res: Response;
    try {
      res = await fetchHtmlSafely(target, ctrl);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof SsrfError) {
        return {
          ok: false,
          error: "このURLへはセキュリティ上アクセスできません。",
        };
      }
      return { ok: false, error: "ページの取得に失敗しました (タイムアウト等)。" };
    }
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

// ---- SSRF 対策 ----
// 公開ページのつもりで渡された URL が、実は内部ネットワーク (127.0.0.1 / 社内IP /
// クラウドのメタデータ 169.254.169.254 等) を指していないかを検証する。
// リダイレクトも野放しにせず、各ホップで再検証する。
// 注: DNS リバインディング (検証後に別IPへ解決される) までは防げないが、
// admin 登録URL・ユーザー投稿URL の想定脅威に対しては十分な多層防御になる。

class SsrfError extends Error {}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // 壊れた値は安全側で拒否
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8 プライベート
  if (a === 127) return true; // 127.0.0.0/8 ループバック
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 リンクローカル (メタデータ含む)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 プライベート
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 プライベート
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // マルチキャスト/予約
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true; // ループバック/未指定
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // fc00::/7 ULA
  if (/^fe[89ab]/.test(s)) return true; // fe80::/10 リンクローカル
  return false;
}

function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) return isPrivateIpv6(ip);
  return true; // 判定不能は拒否
}

// ホスト名を解決し、いずれかのIPが内部向けなら SsrfError を投げる。
async function assertPublicHost(target: URL): Promise<void> {
  const host = target.hostname;
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfError("blocked ip literal");
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfError("dns lookup failed");
  }
  if (addrs.length === 0) throw new SsrfError("no address");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new SsrfError("resolves to private ip");
  }
}

// 内部IP検証 + リダイレクトを手動追従 (最大5ホップ、各ホップで再検証)。
async function fetchHtmlSafely(
  startUrl: URL,
  ctrl: AbortController
): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
      signal: ctrl.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        throw new SsrfError("invalid redirect target");
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new SsrfError("non-http redirect");
      }
      current = next;
      continue;
    }
    return res;
  }
  throw new SsrfError("too many redirects");
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
