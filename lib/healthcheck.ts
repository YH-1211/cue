// 日次ヘルスチェック: 未来イベントの official_url を叩き、
//   - dead_link:     公式URLが 404 / 5xx / タイムアウト
//   - date_mismatch: 公式ページの JSON-LD (schema.org Event.startDate) と DB の日付が食い違う
//   - stale_soon:    開催が近い (14日以内) のに更新が古い (30日以上)
//   - date_tbd:      日程未定 (starts_at が null)
// を検出し event_review_flags テーブルへ同期する。
//
// 完全自動で拾えるのは「機械的に確実な」ものだけ (死活・構造化データの日付ズレ)。
// 構造化データを持たない公式サイトの日付照合は機械では不可のため、近日開催で更新が
// 古いものを stale_soon として拾い、管理者/AI の目視確認に回す (半自動)。

import type { SupabaseClient } from "@supabase/supabase-js";
import { jstParts } from "@/lib/datetime";

const USER_AGENT = "CueBot/1.0 (+https://cue-taupe-eight.vercel.app)";

// official_url を fetch して照合する対象の上限 (開催が近い順)。
// 遠い未来 (数百日先) は情報が固まっていないことが多く、近づいたら自然に対象化される。
const LINK_CHECK_HORIZON_DAYS = 120;
// 開催が近い (この日数以内) のに更新が古いと stale_soon
const NEAR_TERM_DAYS = 14;
// updated_at がこの日数以上前なら「古い」
const STALE_DAYS = 30;
// URL fetch の並列数とタイムアウト
const FETCH_CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 8000;
// タイムアウト/接続失敗のときだけリトライする回数と待ち時間。
// 一時的な瞬断で dead_link を誤検知しないため (HTTP 4xx/5xx は確定的な死なのでリトライしない)。
const NETWORK_RETRIES = 1;
const RETRY_DELAY_MS = 1500;

const DAY_MS = 24 * 60 * 60 * 1000;

export type FlagReason = "dead_link" | "date_mismatch" | "stale_soon" | "date_tbd";
export type FlagSeverity = "info" | "warning" | "critical";

type DetectedFlag = {
  eventId: string;
  reason: FlagReason;
  severity: FlagSeverity;
  detail: string;
  detectedUrl: string | null;
};

type EventRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  effective_end: string | null;
  official_url: string | null;
  updated_at: string;
};

export type HealthcheckSummary = {
  events_total: number;
  links_checked: number;
  links_ok: number;
  dead_link: number;
  date_mismatch: number;
  stale_soon: number;
  date_tbd: number;
  new_flags: number;
  reopened_flags: number;
  resolved_flags: number;
};

// YYYY-MM-DD (JST) に丸める
function jstDayKey(iso: string): string {
  const { year, month, day } = jstParts(new Date(iso));
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 配列を並列数制限つきで map する
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

type ProbeResult =
  | { ok: true; html: string | null }
  | { ok: false; status: number; label: string };

// official_url を1回 GET して、到達性と (取れれば) HTML 先頭を返す。
async function probeOnce(pageUrl: string): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);

    if (res.status >= 400) {
      return { ok: false, status: res.status, label: `HTTP ${res.status}` };
    }

    // 構造化データ照合のため head + 本文先頭 128KB を読む (HTML のときだけ)
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("xhtml")) {
      return { ok: true, html: null };
    }
    const reader = res.body?.getReader();
    if (!reader) return { ok: true, html: null };
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
    return { ok: true, html };
  } catch (e) {
    clearTimeout(timer);
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: 0, label: aborted ? "タイムアウト" : "接続失敗" };
  }
}

// official_url を GET する。タイムアウト/接続失敗 (status 0) のときだけリトライし、
// 一時的な瞬断による dead_link 誤検知を防ぐ。HTTP 4xx/5xx は確定的な死なので即返す。
async function probeUrl(pageUrl: string): Promise<ProbeResult> {
  let last = await probeOnce(pageUrl);
  for (let i = 0; i < NETWORK_RETRIES; i++) {
    if (last.ok || last.status !== 0) return last; // 成功 or 確定的なエラーは即確定
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    last = await probeOnce(pageUrl);
  }
  return last;
}

// HTML 中の JSON-LD から schema.org Event.startDate を集め、最も早い日付を返す。
// (複数公演/複数日イベントは初日を開始日とみなす)
function extractStartDate(html: string): string | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const candidates: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let json: unknown;
    try {
      json = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    collectStartDates(json, candidates);
  }
  if (candidates.length === 0) return null;
  const earliest = Math.min(...candidates);
  return new Date(earliest).toISOString();
}

function collectStartDates(node: unknown, out: number[], depth = 0): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const v of node) collectStartDates(v, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "startDate" && typeof value === "string") {
      const t = Date.parse(value);
      if (!Number.isNaN(t)) out.push(t);
    } else if (typeof value === "object" && value !== null) {
      collectStartDates(value, out, depth + 1);
    }
  }
}

export async function runHealthcheck(admin: SupabaseClient): Promise<HealthcheckSummary> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // 対象は「これからのイベント」(effective_end >= now)。過去分は照合の意味が薄い。
  const { data, error } = await admin
    .from("events")
    .select("id, title, starts_at, ends_at, effective_end, official_url, updated_at")
    .or(`effective_end.gte.${nowIso},effective_end.is.null`)
    .order("starts_at", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`events 取得に失敗: ${error.message}`);
  const events = (data ?? []) as EventRow[];

  const detected: DetectedFlag[] = [];

  // 1) fetch 不要の判定 (date_tbd)
  for (const ev of events) {
    if (!ev.starts_at) {
      detected.push({
        eventId: ev.id,
        reason: "date_tbd",
        severity: "info",
        detail: "日程が未設定 (starts_at が空)",
        detectedUrl: ev.official_url,
      });
    }
  }

  // 2) official_url を持ち、開催が近い/中期のイベントだけ fetch 照合する
  const toFetch = events.filter((ev) => {
    if (!ev.official_url) return false;
    if (!ev.starts_at) return true; // 日程未定でもURL死活は見たい
    const startMs = Date.parse(ev.starts_at);
    if (Number.isNaN(startMs)) return true;
    const daysUntil = (startMs - now) / DAY_MS;
    return daysUntil <= LINK_CHECK_HORIZON_DAYS; // 過去〜120日以内
  });

  let linksOk = 0;
  await mapWithConcurrency(toFetch, FETCH_CONCURRENCY, async (ev) => {
    const probe = await probeUrl(ev.official_url as string);
    if (!probe.ok) {
      const severity: FlagSeverity =
        probe.status === 404 || probe.status === 410 ? "critical" : "warning";
      detected.push({
        eventId: ev.id,
        reason: "dead_link",
        severity,
        detail: `公式URLに到達できません (${probe.label})`,
        detectedUrl: ev.official_url,
      });
      return;
    }
    linksOk += 1;

    // 構造化データの開始日と DB の日付を照合
    if (probe.html && ev.starts_at) {
      const officialStart = extractStartDate(probe.html);
      if (officialStart) {
        const officialDay = jstDayKey(officialStart);
        const dbDay = jstDayKey(ev.starts_at);
        if (officialDay !== dbDay) {
          detected.push({
            eventId: ev.id,
            reason: "date_mismatch",
            severity: "critical",
            detail: `公式(構造化データ):${officialDay} / DB:${dbDay}`,
            detectedUrl: ev.official_url,
          });
        }
      }
    }
  });

  // 3) 近日開催なのに更新が古い (stale_soon)
  for (const ev of events) {
    if (!ev.starts_at) continue;
    const startMs = Date.parse(ev.starts_at);
    if (Number.isNaN(startMs)) continue;
    const daysUntil = (startMs - now) / DAY_MS;
    if (daysUntil < 0 || daysUntil > NEAR_TERM_DAYS) continue;
    const updatedMs = Date.parse(ev.updated_at);
    if (Number.isNaN(updatedMs)) continue;
    const daysStale = (now - updatedMs) / DAY_MS;
    if (daysStale >= STALE_DAYS) {
      detected.push({
        eventId: ev.id,
        reason: "stale_soon",
        severity: "warning",
        detail: `開催まで${Math.round(daysUntil)}日 / 最終更新から${Math.round(daysStale)}日経過`,
        detectedUrl: ev.official_url,
      });
    }
  }

  // 4) DB へ同期 (upsert + open のまま未検出のものを自動 resolved に)
  const sync = await syncFlags(admin, detected);

  const count = (r: FlagReason) => detected.filter((d) => d.reason === r).length;
  return {
    events_total: events.length,
    links_checked: toFetch.length,
    links_ok: linksOk,
    dead_link: count("dead_link"),
    date_mismatch: count("date_mismatch"),
    stale_soon: count("stale_soon"),
    date_tbd: count("date_tbd"),
    new_flags: sync.newFlags,
    reopened_flags: sync.reopenedFlags,
    resolved_flags: sync.resolvedFlags,
  };
}

type ExistingFlag = {
  id: string;
  event_id: string;
  reason: FlagReason;
  status: "open" | "resolved" | "ignored";
  ignore_until: string | null;
  ignored_detail: string | null;
};

async function syncFlags(
  admin: SupabaseClient,
  detected: DetectedFlag[]
): Promise<{ newFlags: number; reopenedFlags: number; resolvedFlags: number }> {
  const nowIso = new Date().toISOString();

  // 現在の全フラグを取得 (件数は多くないので全件)
  const { data: existingData } = await admin
    .from("event_review_flags")
    .select("id, event_id, reason, status, ignore_until, ignored_detail");
  const existing = (existingData ?? []) as ExistingFlag[];
  const byKey = new Map<string, ExistingFlag>();
  for (const f of existing) byKey.set(`${f.event_id}:${f.reason}`, f);

  const detectedKeys = new Set(detected.map((d) => `${d.eventId}:${d.reason}`));

  let newFlags = 0;
  let reopenedFlags = 0;

  for (const d of detected) {
    const key = `${d.eventId}:${d.reason}`;
    const prev = byKey.get(key);
    if (!prev) {
      // 新規
      await admin.from("event_review_flags").insert({
        event_id: d.eventId,
        reason: d.reason,
        severity: d.severity,
        detail: d.detail,
        detected_url: d.detectedUrl,
        status: "open",
        first_seen_at: nowIso,
        last_seen_at: nowIso,
      });
      newFlags += 1;
    } else if (prev.status === "ignored") {
      // 「無視」中のフラグは基本そっとしておくが、以下のときは open に戻して再確認を促す:
      //   - ignore_until を過ぎた (期限切れ。サイト復旧 or 本当に閉幕した可能性)
      //   - 無視した時点と detail が変わった (403 -> 404 等、状況が変わった)
      const expired = prev.ignore_until != null && Date.parse(prev.ignore_until) <= Date.now();
      const changed = prev.ignored_detail != null && prev.ignored_detail !== d.detail;
      if (expired || changed) {
        await admin
          .from("event_review_flags")
          .update({
            status: "open",
            detail: d.detail,
            severity: d.severity,
            last_seen_at: nowIso,
            resolved_at: null,
            ignore_until: null,
            ignored_detail: null,
          })
          .eq("id", prev.id);
        reopenedFlags += 1;
      } else {
        await admin
          .from("event_review_flags")
          .update({ last_seen_at: nowIso, detail: d.detail, severity: d.severity })
          .eq("id", prev.id);
      }
    } else if (prev.status === "resolved") {
      // 一度解決したのに再検出 → 再オープン
      await admin
        .from("event_review_flags")
        .update({
          status: "open",
          detail: d.detail,
          severity: d.severity,
          last_seen_at: nowIso,
          resolved_at: null,
        })
        .eq("id", prev.id);
      reopenedFlags += 1;
    } else {
      // open のまま継続
      await admin
        .from("event_review_flags")
        .update({ last_seen_at: nowIso, detail: d.detail, severity: d.severity })
        .eq("id", prev.id);
    }
  }

  // 今回検出されなかった = 解消したとみなして自動 resolved。
  // ignored も対象に含める (公式サイトが復旧して検出されなくなったのに
  // 「無視」のまま残り続けるのを防ぐ)。
  let resolvedFlags = 0;
  const toResolve = existing.filter(
    (f) =>
      (f.status === "open" || f.status === "ignored") &&
      !detectedKeys.has(`${f.event_id}:${f.reason}`)
  );
  if (toResolve.length > 0) {
    const ids = toResolve.map((f) => f.id);
    await admin
      .from("event_review_flags")
      .update({
        status: "resolved",
        resolved_at: nowIso,
        ignore_until: null,
        ignored_detail: null,
      })
      .in("id", ids);
    resolvedFlags = toResolve.length;
  }

  return { newFlags, reopenedFlags, resolvedFlags };
}
