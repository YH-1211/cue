// 一回きりの移行スクリプト:
// cover_image_url が「なし」または Unsplash 仮画像のイベントについて、
// official_url の公式ページから og:image / JSON-LD image を取得して
// 本物のカバー画像 URL を埋める。
//
// 使い方 (cue ディレクトリ直下で):
//   node scripts/backfill-cover-images.mjs          # dry-run (DBは変更しない)
//   node scripts/backfill-cover-images.mjs --apply  # 実際に DB を更新
//
// 設計方針:
// - 画像は自前保存せず「公式ページの画像URLをそのまま」保存する (複製権を避ける)。
// - 取得した画像URLが本当に画像として応答するか (content-type: image/*) を確認してから採用。
// - SSRF 対策として内部IP宛は弾く。リダイレクトは手動で最大5ホップ再検証。
// - lib/extract-event.ts と同じ抽出方針だが、依存なしで単体実行できるよう自己完結。

import { readFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const APPLY = process.argv.includes("--apply");
const USER_AGENT = "CueBot/1.0 (+https://cue-taupe-eight.vercel.app)";

// ---- .env.local 読み込み (最小パーサ) ----
function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が .env.local に必要です。");
  process.exit(1);
}

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// ---- SSRF: 内部IP判定 ----
function isPrivateIpv4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}
function isPrivateIpv6(ip) {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateIpv4(m[1]);
  if (s.startsWith("fc") || s.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(s)) return true;
  return false;
}
function isBlockedIp(ip) {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) return isPrivateIpv6(ip);
  return true;
}
async function assertPublicHost(target) {
  const host = target.hostname;
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error("blocked ip");
    return;
  }
  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0) throw new Error("no address");
  for (const a of addrs) if (isBlockedIp(a.address)) throw new Error("private ip");
}

// リダイレクト手動追従 + 各ホップ再検証
async function safeFetch(startUrl, { accept }, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let current = new URL(startUrl);
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new Error("non-http");
    }
    for (let hop = 0; hop < 5; hop++) {
      await assertPublicHost(current);
      const res = await fetch(current.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        redirect: "manual",
        signal: ctrl.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return res;
        const next = new URL(loc, current);
        if (next.protocol !== "http:" && next.protocol !== "https:") throw new Error("bad redirect");
        current = next;
        continue;
      }
      return res;
    }
    throw new Error("too many redirects");
  } finally {
    clearTimeout(timer);
  }
}

// ---- HTML から画像URLを抽出 ----
function absUrl(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}
function matchMeta(html, prop) {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pats = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`, "i"),
  ];
  for (const re of pats) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}
function pickJsonLdImage(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let json;
    try {
      json = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const img = findEventImage(json, 0);
    if (img) return img;
  }
  return null;
}
function findEventImage(node, depth) {
  if (depth > 6 || node == null) return null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const f = findEventImage(v, depth + 1);
      if (f) return f;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const t = node["@type"];
  const isEvent =
    (typeof t === "string" && /event/i.test(t)) ||
    (Array.isArray(t) && t.some((x) => typeof x === "string" && /event/i.test(x)));
  if (isEvent && node.image) {
    const im = Array.isArray(node.image) ? node.image[0] : node.image;
    if (typeof im === "string") return im;
    if (im && typeof im === "object" && typeof im.url === "string") return im.url;
  }
  for (const key of ["@graph", "mainEntity", "subEvent"]) {
    if (key in node) {
      const f = findEventImage(node[key], depth + 1);
      if (f) return f;
    }
  }
  return null;
}

async function extractImage(pageUrl) {
  const res = await safeFetch(pageUrl, { accept: "text/html,application/xhtml+xml" });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("text/html") && !ctype.includes("xhtml")) {
    return { ok: false, reason: "not html" };
  }
  // 256KB まで読む
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, reason: "no body" };
  const decoder = new TextDecoder("utf-8");
  let html = "";
  const MAX = 256 * 1024;
  while (html.length < MAX) {
    const { value, done } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
  }
  try {
    await reader.cancel();
  } catch {}
  const raw =
    pickJsonLdImage(html) ||
    matchMeta(html, "og:image") ||
    matchMeta(html, "twitter:image") ||
    matchMeta(html, "twitter:image:src");
  if (!raw) return { ok: false, reason: "no og:image" };
  const abs = absUrl(raw.trim(), pageUrl);
  if (!abs) return { ok: false, reason: "bad image url" };
  return { ok: true, imageUrl: abs };
}

// 画像URLの妥当性を確認する。
// og:image は「サイト自身がその画像を代表画像として申告」しているので基本は信頼する。
// ただし明らかに画像でない応答 (HTMLが返る = ページ削除やリダイレクト先がHTML等) は弾く。
// 画像CDNが bot UA を 403 で拒否するケースは、実ブラウザでは表示されるため採用する。
async function verifyImage(imageUrl) {
  try {
    const res = await safeFetch(imageUrl, { accept: "image/*" }, 8000);
    const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
    try {
      await res.body?.cancel();
    } catch {}
    if (ctype.startsWith("image/")) return true; // 明確に画像
    if (ctype.startsWith("text/html")) return false; // 明確に画像でない (ページ本体等)
    // UA拒否(403)や content-type 不明は、og:image 申告を信頼して採用
    return res.status === 403 || res.status === 200 || ctype === "";
  } catch {
    // ネットワークエラー等は不採用 (存在しない可能性)
    return false;
  }
}

// ---- メイン ----
function needsImage(url) {
  if (!url) return true;
  try {
    return (new URL(url).hostname || "").includes("unsplash.com");
  } catch {
    return true;
  }
}

async function main() {
  console.log(`モード: ${APPLY ? "APPLY (DB更新)" : "DRY-RUN (変更なし)"}\n`);

  const listRes = await fetch(
    `${SUPA_URL}/rest/v1/events?select=id,title,cover_image_url,official_url&limit=1000`,
    { headers: restHeaders }
  );
  const all = await listRes.json();
  const targets = all.filter((e) => e.official_url && needsImage(e.cover_image_url));
  console.log(`対象イベント: ${targets.length} 件 (全 ${all.length} 件中)\n`);

  const results = { found: [], notfound: [], error: [] };

  for (let i = 0; i < targets.length; i++) {
    const ev = targets[i];
    const tag = `[${i + 1}/${targets.length}]`;
    try {
      const ext = await extractImage(ev.official_url);
      if (!ext.ok) {
        results.notfound.push({ ...ev, reason: ext.reason });
        console.log(`${tag} ✗ ${ev.title} — ${ext.reason}`);
        continue;
      }
      const valid = await verifyImage(ext.imageUrl);
      if (!valid) {
        results.notfound.push({ ...ev, reason: "画像応答が不正" });
        console.log(`${tag} ✗ ${ev.title} — 画像応答が不正 (${ext.imageUrl})`);
        continue;
      }
      results.found.push({ ...ev, imageUrl: ext.imageUrl });
      console.log(`${tag} ✓ ${ev.title}\n        → ${ext.imageUrl}`);

      if (APPLY) {
        const upd = await fetch(`${SUPA_URL}/rest/v1/events?id=eq.${ev.id}`, {
          method: "PATCH",
          headers: {
            ...restHeaders,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ cover_image_url: ext.imageUrl }),
        });
        if (!upd.ok) {
          console.log(`        ⚠ 更新失敗 HTTP ${upd.status}`);
        }
      }
    } catch (e) {
      results.error.push({ ...ev, reason: String(e?.message || e) });
      console.log(`${tag} ! ${ev.title} — ${String(e?.message || e)}`);
    }
  }

  console.log("\n==== 結果まとめ ====");
  console.log(`✓ 画像取得できた   : ${results.found.length}`);
  console.log(`✗ 画像なし/取得不可 : ${results.notfound.length}`);
  console.log(`! エラー           : ${results.error.length}`);
  if (!APPLY) {
    console.log("\n※ DRY-RUN のため DB は変更していません。反映するには --apply を付けて再実行。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
