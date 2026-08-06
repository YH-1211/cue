import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyLineSignature, replyLineMessage, type LineMessage } from "@/lib/line";
import {
  startOfTodayJstIso,
  jstParts,
  jstDateToUtc,
} from "@/lib/datetime";
import {
  eventScheduleLabel,
  inferCategory,
  parentOf,
  categoriesUnderParent,
  categoryCoverPath,
  isParentCategory,
  PARENT_LABELS,
  CATEGORY_KEYWORDS,
  type EventCategory,
} from "@/lib/events";
import { SITE } from "@/lib/site";
import {
  AREA_COORDS,
  NEIGHBORHOOD_TO_AREA,
  nearbyAreas,
  type AreaName,
} from "@/lib/tokyo-areas";
import { learnCategoryWeights } from "@/lib/personalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LINE Webhook イベントの必要最小限の型。
type LineSource = { type: string; userId?: string };
type LineEvent = {
  type: string;
  replyToken?: string;
  source?: LineSource;
  message?: {
    type: string;
    text?: string;
    latitude?: number;
    longitude?: number;
  };
};

// 連携コードで使う文字 (actions.ts の CODE_ALPHABET と一致させること)。
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

const WELCOME =
  "Cue の友だち追加ありがとうございます！🎉\n" +
  "東京・関東のイベントが見つかるアプリ「Cue」です。\n\n" +
  "このトークでできること👇\n" +
  "・「イベント」→ 近々の開催をお届け\n" +
  "・「使い方」→ アプリの説明\n\n" +
  "さらに、興味・エリアに合わせた通知を LINE で受け取るには連携が必要です。" +
  "Cue アプリの「通知設定」で連携コードを発行して、ここに送ってください！\n\n" +
  SITE.url;

// ---- 意図判定 ----------------------------------------------------------

type Intent = "event" | "help" | "greeting" | "keyword" | "unknown";

const EVENT_WORDS = [
  "イベント", "いべんと", "近く", "ちかく", "近所", "週末", "おすすめ",
  "オススメ", "やってる", "催し", "フェス", "祭り", "まつり", "予定", "何かある",
  "なにかある",
  // 時間ワード (日付絞り込みは detectWindow が担当。ここでは意図判定の保険)
  "今日", "きょう", "本日", "明日", "あした", "あす",
  // ジャンル・遊び系ワード
  "花火", "ライブ", "展示", "展覧", "マーケット", "デート", "遊び", "遊べる",
  "どこ行く", "どこいく", "暇", "ひま", "何する", "なにする", "お出かけ",
  "おでかけ", "スポット",
];
const HELP_WORDS = [
  "使い方", "つかいかた", "つかい方", "ヘルプ", "help", "アプリ", "何ができる",
  "なにができる", "できること", "説明", "どうやって", "cueって", "cueとは",
  "とは",
];
const GREETING_WORDS = [
  "こんにちは", "おはよう", "こんばんは", "はじめまして", "よろしく",
  "hello", "hi", "hey", "やあ", "ちわ", "こんちは",
];
const KEYWORD_WORDS = [
  "キーワード", "きーわーど", "メニュー", "めにゅー", "一覧", "コマンド",
  "何て送れば", "なんて送れば", "なにを送れば", "何を送れば", "何が送れる",
  "なにが送れる",
];

function classify(text: string): Intent {
  const t = text.toLowerCase();
  if (EVENT_WORDS.some((w) => t.includes(w.toLowerCase()))) return "event";
  if (KEYWORD_WORDS.some((w) => t.includes(w.toLowerCase()))) return "keyword";
  if (HELP_WORDS.some((w) => t.includes(w.toLowerCase()))) return "help";
  if (GREETING_WORDS.some((w) => t.includes(w.toLowerCase()))) return "greeting";
  return "unknown";
}

// ---- 日付ウィンドウ判定 -------------------------------------------------

// 「今日」「明日」「今週末」などの語から、絞り込む JST の期間 [start, end) を返す。
// 該当しなければ null (= 近々一覧を表示)。
type EventWindow = { label: string; startIso: string; endIso: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function detectWindow(text: string, now: Date = new Date()): EventWindow | null {
  const p = jstParts(now);
  const todayStart = jstDateToUtc(p.year, p.month, p.day, 0);

  if (/今日|きょう|本日/.test(text)) {
    return {
      label: "今日",
      startIso: todayStart.toISOString(),
      endIso: new Date(todayStart.getTime() + DAY_MS).toISOString(),
    };
  }
  if (/明日|あした|あす/.test(text)) {
    const start = new Date(todayStart.getTime() + DAY_MS);
    return {
      label: "明日",
      startIso: start.toISOString(),
      endIso: new Date(start.getTime() + DAY_MS).toISOString(),
    };
  }
  if (/今週末|週末|土日|しゅうまつ/.test(text)) {
    // 直近の土曜 0:00 〜 月曜 0:00。今日が土日ならその週末を対象にする。
    const dow = p.dow; // 0=日, 6=土
    const daysUntilSat = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
    const satStart = new Date(todayStart.getTime() + daysUntilSat * DAY_MS);
    const monStart = new Date(satStart.getTime() + 2 * DAY_MS);
    // 過去は含めない (日曜に「週末」と言われたら日曜のみ)。
    const start = new Date(Math.max(satStart.getTime(), todayStart.getTime()));
    return {
      label: "今週末",
      startIso: start.toISOString(),
      endIso: monStart.toISOString(),
    };
  }
  return null;
}

// ---- ジャンル判定 ------------------------------------------------------

// 「祭り」「ライブ」「花火」などの語から絞り込む親ジャンルを判定する。
// アプリと同じ inferCategory を使い、親カテゴリー単位 (配下サブ全部) で絞る。
type EventCategoryFilter = { label: string; values: string[] };

function detectCategory(text: string): EventCategoryFilter | null {
  const inferred = inferCategory(text);
  if (!inferred) return null;
  const parent = parentOf(inferred);
  return {
    label: PARENT_LABELS[parent],
    values: categoriesUnderParent(parent) as string[],
  };
}

// ---- ジャンル除外判定 (否定) --------------------------------------------

// 「花火以外」「祭りじゃなくて」のような、ジャンルキーワード直後に否定語が
// 続くパターンを検出する。ヒットしたキーワード+否定語の部分は正の判定に
// 混ざらないよう text から取り除いてから detectCategory を呼ぶこと。
const NEGATION_SUFFIX =
  "(?:以外|じゃなくて|じゃない|ではなく|を除いて|を除く|抜きで|抜き)";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectExcludedCategory(
  text: string
): { filter: EventCategoryFilter; matched: string } | null {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      const re = new RegExp(`${escapeRegExp(kw)}(?:の)?${NEGATION_SUFFIX}`);
      const m = text.match(re);
      if (m) {
        const parent = parentOf(category);
        return {
          filter: {
            label: PARENT_LABELS[parent],
            values: categoriesUnderParent(parent) as string[],
          },
          matched: m[0],
        };
      }
    }
  }
  return null;
}

// ---- 地名判定 ----------------------------------------------------------

// 「恵比寿」「新宿」「東京」などの語から絞り込む区 (events.area) を判定する。
// events.area は区単位の粒度しかないため、地名は該当区へ丸める近似。
// 「恵比寿」のような有名地名を先に見てから、区名そのもの (新宿・渋谷 等) を見る。
// 1文字の区名 (港・北・柏) は他の単語に紛れやすいので除外する。
type EventAreaFilter = { label: string; value: AreaName };

function detectArea(text: string): EventAreaFilter | null {
  const neighborhoods = Object.entries(NEIGHBORHOOD_TO_AREA).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [name, area] of neighborhoods) {
    if (text.includes(name)) return { label: name, value: area as AreaName };
  }

  const wards = (Object.keys(AREA_COORDS) as AreaName[])
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const ward of wards) {
    if (text.includes(ward)) return { label: ward, value: ward };
  }
  return null;
}

// ---- 会話の文脈継続 -----------------------------------------------------

// 「その中で」「他には」などの続き会話ワードを含むメッセージでは、今回の
// メッセージから取れなかった次元 (window/category/area/excludeCategory) だけ
// 直前の絞り込み条件 (TTL 以内) を引き継ぐ。単なる「渋谷で」等の単発指定は
// 誤って古い条件を引きずらないよう、続き会話ワードがある時だけ発動する。
const CONTINUATION_WORDS = [
  "その中で", "そのなかで", "この中で", "このなかで",
  "他には", "ほかには", "他にも", "ほかにも",
  "続き", "つづき", "違うのは", "ちがうのは", "他にある", "ほかにある",
  "近いのは", "近いの", "もっとある",
];
const CONTEXT_TTL_MS = 30 * 60 * 1000; // 30分

function isContinuationText(text: string): boolean {
  return CONTINUATION_WORDS.some((w) => text.includes(w));
}

async function loadConversationState(
  admin: SupabaseClient,
  lineUserId: string
): Promise<EventFilter | null> {
  const { data } = await admin
    .from("line_conversation_state")
    .select(
      "window_label, window_start, window_end, category_label, category_values, area_label, area_value, exclude_label, exclude_values, updated_at"
    )
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.updated_at as string).getTime() > CONTEXT_TTL_MS) {
    return null;
  }

  const window: EventWindow | null =
    data.window_label && data.window_start && data.window_end
      ? {
          label: data.window_label as string,
          startIso: data.window_start as string,
          endIso: data.window_end as string,
        }
      : null;
  const category: EventCategoryFilter | null =
    data.category_label && data.category_values
      ? { label: data.category_label as string, values: data.category_values as string[] }
      : null;
  const area: EventAreaFilter | null =
    data.area_label && data.area_value
      ? { label: data.area_label as string, value: data.area_value as AreaName }
      : null;
  const excludeCategory: EventCategoryFilter | null =
    data.exclude_label && data.exclude_values
      ? { label: data.exclude_label as string, values: data.exclude_values as string[] }
      : null;

  return { window, category, area, excludeCategory };
}

async function saveConversationState(
  admin: SupabaseClient,
  lineUserId: string,
  filter: EventFilter
): Promise<void> {
  await admin.from("line_conversation_state").upsert({
    line_user_id: lineUserId,
    window_label: filter.window?.label ?? null,
    window_start: filter.window?.startIso ?? null,
    window_end: filter.window?.endIso ?? null,
    category_label: filter.category?.label ?? null,
    category_values: filter.category?.values ?? null,
    area_label: filter.area?.label ?? null,
    area_value: filter.area?.value ?? null,
    exclude_label: filter.excludeCategory?.label ?? null,
    exclude_values: filter.excludeCategory?.values ?? null,
    updated_at: new Date().toISOString(),
  });
}

// 今回のメッセージで取れなかった次元だけ、直前の条件で補う。
function mergeWithContext(current: EventFilter, stored: EventFilter): EventFilter {
  return {
    window: current.window ?? stored.window ?? null,
    category: current.category ?? stored.category ?? null,
    area: current.area ?? stored.area ?? null,
    excludeCategory: current.excludeCategory ?? stored.excludeCategory ?? null,
  };
}

// ---- 連携コード --------------------------------------------------------

// メッセージから 6 桁の連携コードを取り出す (コード用文字のみ・厳密)。
function extractCode(text: string): string | null {
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE_RE.test(normalized) ? normalized : null;
}

type LinkResult = "linked" | "expired" | "notacode";

async function tryLinkByCode(
  admin: SupabaseClient,
  code: string,
  lineUserId: string
): Promise<LinkResult> {
  const { data: link } = await admin
    .from("line_link_codes")
    .select("code, user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  // 発行したコードでなければ「コードではない」扱いにして通常会話へ回す。
  if (!link) return "notacode";
  if (link.used_at || new Date(link.expires_at) < new Date()) return "expired";

  // 既に他アカウントがこの LINE を使っていたら外してから付け替える。
  await admin
    .from("profiles")
    .update({ line_user_id: null })
    .eq("line_user_id", lineUserId)
    .neq("id", link.user_id);

  const { error } = await admin
    .from("profiles")
    .update({ line_user_id: lineUserId, notify_via_line: true })
    .eq("id", link.user_id);
  if (error) throw error;

  await admin
    .from("line_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  return "linked";
}

// ---- イベント応答 ------------------------------------------------------

type EventRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  is_permanent: boolean | null;
  area: string | null;
  venue_name: string | null;
  category: string | null;
  cover_image_url: string | null;
};

// 連携済みユーザーの興味タグ・活動エリア・保存履歴からの学習重み。返信の並び替えに使う。
type Personalization = {
  interests: Set<string>;
  area: string | null;
  catWeights: Partial<Record<EventCategory, number>>;
};

// 親カテゴリは配下サブに展開した一致判定用セットにする (アプリと同じ扱い)。
function expandInterestSet(cats: string[] | null | undefined): Set<string> {
  const set = new Set<string>();
  for (const c of cats ?? []) {
    const cat = c as EventCategory;
    if (isParentCategory(cat)) {
      for (const sub of categoriesUnderParent(cat)) set.add(sub);
    } else {
      set.add(c);
    }
  }
  return set;
}

// LINE userId から連携済みプロフィールの興味・エリア・保存履歴の学習重みを引く。未連携なら null。
async function getPersonalization(
  admin: SupabaseClient,
  lineUserId: string
): Promise<Personalization | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, interest_categories, home_area")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!data) return null;
  const interests = expandInterestSet(
    data.interest_categories as string[] | null
  );
  const area = (data.home_area as string | null) ?? null;
  const catWeights = await learnCategoryWeights(admin, data.id as string);
  if (interests.size === 0 && !area && Object.keys(catWeights).length === 0) {
    return null;
  }
  return { interests, area, catWeights };
}

// これから開催のもの (常設・開催中を除く未来のイベント)。
function isUpcoming(e: EventRow): boolean {
  return (
    !e.is_permanent &&
    !!e.starts_at &&
    new Date(e.starts_at).getTime() > Date.now()
  );
}

type EventFilter = {
  window?: EventWindow | null;
  category?: EventCategoryFilter | null;
  area?: EventAreaFilter | null;
  excludeCategory?: EventCategoryFilter | null;
};

// 期間・地名・ジャンルのラベルを組み立てる (例: 「今週末の渋谷の祭り」「近々の音楽」)。
function filterLabel(filter: EventFilter): string {
  const parts = [
    filter.window?.label,
    filter.area?.label,
    filter.category?.label,
  ].filter(Boolean);
  const base = parts.length > 0 ? parts.join("の") : "近々";
  return filter.excludeCategory
    ? `${base}(${filter.excludeCategory.label}を除く)`
    : base;
}

// イベント1件ぶんの Flex Bubble (カード) を組み立てる。
function buildEventBubble(e: EventRow): Record<string, unknown> {
  const sched = eventScheduleLabel(
    e.starts_at,
    e.ends_at,
    e.is_permanent ?? false
  );
  const where = [e.area, e.venue_name].filter(Boolean).join(" / ");
  const category = (e.category as EventCategory | null) ?? "art";
  const imageUrl = e.cover_image_url ?? `${SITE.url}${categoryCoverPath(category)}`;

  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: e.title,
      weight: "bold",
      size: "md",
      wrap: true,
      maxLines: 2,
    },
    {
      type: "text",
      text: `🗓️ ${sched.text}`,
      size: "sm",
      color: "#888888",
      wrap: true,
      margin: "sm",
    },
  ];
  if (where) {
    bodyContents.push({
      type: "text",
      text: `📍 ${where}`,
      size: "sm",
      color: "#888888",
      wrap: true,
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: "#FF7A00",
          action: {
            type: "uri",
            label: "詳しく見る",
            uri: `${SITE.url}/events/${e.id}`,
          },
        },
      ],
    },
  };
}

async function buildEventMessages(
  admin: SupabaseClient,
  filter: EventFilter = {},
  personal: Personalization | null = null
): Promise<LineMessage[]> {
  const { window, category, area, excludeCategory } = filter;

  // 多めに取得して JS 側で「誘って行きやすい順」に並べ替える。
  let query = admin
    .from("events")
    .select(
      "id, title, starts_at, ends_at, is_permanent, area, venue_name, category, cover_image_url"
    )
    .eq("approved", true)
    .gte("effective_end", startOfTodayJstIso());

  // 「今日」「明日」「今週末」などが指定されたら、その期間に開催中のものへ絞る。
  // (期間終了が指定開始以降 かつ 開始が指定終了より前 = 期間が重なる)
  if (window) {
    query = query
      .gte("effective_end", window.startIso)
      .lt("starts_at", window.endIso);
  }

  // 「祭り」「ライブ」などジャンル指定があれば、その親ジャンル配下に絞る。
  if (category) {
    query = query.in("category", category.values);
  }

  // 「恵比寿」「新宿」などの地名指定があれば、対応する区へ絞る。
  if (area) {
    query = query.eq("area", area.value);
  }

  const { data } = await query
    .order("starts_at", { ascending: true })
    .limit(30);

  // 「花火以外」「祭りじゃなくて」などの除外指定があれば、そのジャンル配下を取り除く。
  const events = ((data ?? []) as EventRow[]).filter(
    (e) => !excludeCategory || !e.category || !excludeCategory.values.includes(e.category)
  );
  if (events.length === 0) {
    const text = window || category || area || excludeCategory
      ? `${filterLabel(filter)}のイベントは見つかりませんでした🙏\n` +
        "ほかの条件はアプリで探してみてください → " +
        SITE.url +
        "/search"
      : "いま公開中の直近イベントが見つかりませんでした🙏\n" +
        "アプリで探してみてください → " +
        SITE.url +
        "/search";
    return [{ type: "text", text }];
  }

  // 連携ユーザーなら、興味タグ一致(+2)・活動エリア一致(+1)・保存履歴の学習重み(最大+2)でスコアリング。
  const matchScore = (e: EventRow): number => {
    if (!personal) return 0;
    let s = 0;
    if (e.category && personal.interests.has(e.category)) s += 2;
    if (personal.area && e.area && e.area === personal.area) s += 1;
    if (e.category) s += personal.catWeights[e.category as EventCategory] ?? 0;
    return s;
  };

  // これから開催 (近い順) → 開催中 (終わりが近い順) → 常設 の順で上位5件。
  const upcoming = events.filter(isUpcoming); // すでに starts_at 昇順
  if (personal) {
    // 興味・エリアに合うものを優先。同スコアなら開催が近い順を保つ。
    upcoming.sort((a, b) => {
      const d = matchScore(b) - matchScore(a);
      if (d !== 0) return d;
      const aStart = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
      const bStart = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
      return aStart - bStart;
    });
  }
  const ongoing = events
    .filter((e) => !isUpcoming(e))
    .sort((a, b) => {
      const aPerm = a.is_permanent ? 1 : 0;
      const bPerm = b.is_permanent ? 1 : 0;
      if (aPerm !== bPerm) return aPerm - bPerm; // 常設は後ろへ
      const aEnd = a.ends_at ? new Date(a.ends_at).getTime() : Infinity;
      const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
      return aEnd - bEnd; // 終わりが近い順
    });
  const picked = [...upcoming, ...ongoing].slice(0, 5);
  const personalized = picked.some((e) => matchScore(e) > 0);

  const headerLabel =
    window || category || area || excludeCategory
      ? `${filterLabel(filter)}のイベントです！👇`
      : personalized
        ? "あなたの興味に合わせて選んだ、近々のイベントです！👇"
        : "近々行けるイベントです！👇";

  const header =
    headerLabel +
    "\nタップで詳細が見られます。気になるものはこのままトークで友だちに送って誘えます📲";

  const carousel = {
    type: "carousel",
    contents: picked.map(buildEventBubble),
  };

  return [
    { type: "text", text: header },
    { type: "flex", altText: headerLabel, contents: carousel },
    {
      type: "text",
      text: `もっと見る → ${SITE.url}/search`,
    },
  ];
}

const HELP_TEXT =
  "Cue は東京・関東のイベントが見つかるアプリです！🎪\n\n" +
  "🔍 ジャンル・エリアで検索\n" +
  "📍 興味と現在地に合わせたおすすめ通知\n" +
  "🎟️ チケット発売・締切のリマインド\n" +
  "⭐ 気になるイベントを保存\n\n" +
  "アプリはこちら → " +
  SITE.url +
  "\n\nこのトークでは、たとえばこんな言葉が使えます👇\n" +
  "・「イベント」→ 近々の開催をご案内\n" +
  "・「今日」「今週末」→ その日程で絞り込み\n" +
  "・「祭り」「ライブ」「アート」→ ジャンルで絞り込み\n" +
  "・「今週末の花火」のように組み合わせもOK\n\n" +
  "使える言葉の一覧は「キーワード」と送ると確認できます！";

const KEYWORD_TEXT =
  "このトークで送れる言葉の一覧です📝\n\n" +
  "▼ イベントを見る\n" +
  "「イベント」「近くのイベント」「おすすめ」\n\n" +
  "▼ 日程でしぼる\n" +
  "「今日」「明日」「今週末」\n\n" +
  "▼ ジャンルでしぼる\n" +
  "「祭り」「花火」「ライブ」「音楽」「アート」\n" +
  "「美術館」「演劇」「グルメ」「マルシェ」\n" +
  "「映画」「相撲」「野球」など\n\n" +
  "▼ 地名でしぼる\n" +
  "「新宿」「渋谷」「恵比寿」「六本木」など\n\n" +
  "▼ 除外もOK\n" +
  "「花火以外」「祭りじゃなくて」\n\n" +
  "▼ 組み合わせもOK\n" +
  "「今週末の花火」「渋谷のグルメ」\n\n" +
  "▼ 現在地で探す\n" +
  "位置情報(📎から送信)で近くのエリアを絞り込み\n\n" +
  "▼ 続けて絞り込む\n" +
  "「その中で近いのは」「他には」\n\n" +
  "▼ その他\n" +
  "「使い方」→ アプリの説明";

const GREETING_TEXT =
  "こんにちは！Cue です🐾\n" +
  "「イベント」で近々の開催、「使い方」でアプリの説明をご案内します。";

const FALLBACK_TEXT =
  "うまく聞き取れませんでした🙏\n\n" +
  "・「イベント」→ 近々の開催をご案内\n" +
  "・「キーワード」→ 送れる言葉の一覧\n" +
  "・「使い方」→ アプリの説明\n" +
  "・連携コード → アカウント連携\n\n" +
  "と送ってみてください！";

// ---- イベントハンドラ --------------------------------------------------

async function handleFollow(ev: LineEvent) {
  if (ev.replyToken) {
    await replyLineMessage(ev.replyToken, [{ type: "text", text: WELCOME }]);
  }
}

async function handleUnfollow(ev: LineEvent) {
  const lineUserId = ev.source?.userId;
  if (!lineUserId) return;
  const admin = createAdminClient();
  // ブロック / 友だち解除されたら連携を外す。
  await admin
    .from("profiles")
    .update({ line_user_id: null })
    .eq("line_user_id", lineUserId);
}

// LINE の位置情報共有 (ピン送信) から、最寄りの区で絞り込んで返す。
async function handleLocationMessage(ev: LineEvent) {
  const lineUserId = ev.source?.userId;
  const lat = ev.message?.latitude;
  const lng = ev.message?.longitude;
  if (!lineUserId || !ev.replyToken || lat == null || lng == null) return;

  const admin = createAdminClient();
  // 半径 200km あれば関東全域をカバーできるので、実質「一番近い区」を取る。
  const nearest = nearbyAreas({ lat, lng }, 200)[0];
  if (!nearest) {
    await replyLineMessage(ev.replyToken, [
      { type: "text", text: "近くのエリアが見つかりませんでした🙏" },
    ]);
    return;
  }

  const area: EventAreaFilter = { label: nearest.area, value: nearest.area };
  const filter: EventFilter = { area };
  const personal = await getPersonalization(admin, lineUserId);
  const messages = await buildEventMessages(admin, filter, personal);
  messages.unshift({
    type: "text",
    text: `📍 現在地から一番近いのは「${nearest.area}」エリア（約${nearest.km.toFixed(1)}km）でした！`,
  });
  await replyLineMessage(ev.replyToken, messages);
  await saveConversationState(admin, lineUserId, filter);
}

async function handleMessage(ev: LineEvent) {
  if (ev.message?.type === "location") return handleLocationMessage(ev);

  const lineUserId = ev.source?.userId;
  const text = ev.message?.type === "text" ? ev.message.text ?? "" : "";
  if (!lineUserId || !ev.replyToken) return;

  const admin = createAdminClient();

  // 1) 連携コードらしき文字列なら連携を試す。
  const code = extractCode(text);
  if (code) {
    const result = await tryLinkByCode(admin, code, lineUserId);
    if (result === "linked") {
      await replyLineMessage(ev.replyToken, [
        {
          type: "text",
          text:
            "連携が完了しました！✅\n" +
            "これからは興味・エリアに合ったイベントを LINE でお届けします。\n" +
            "通知はいつでも Cue アプリの設定でオフにできます。",
        },
      ]);
      return;
    }
    if (result === "expired") {
      await replyLineMessage(ev.replyToken, [
        {
          type: "text",
          text: "コードが無効か期限切れです。Cue アプリでもう一度発行してください。",
        },
      ]);
      return;
    }
    // "notacode" → 通常会話として続行
  }

  // 2) 意図判定して返信。
  // 「今日」「明日」「今週末」＝期間、「祭り」「ライブ」＝ジャンル、
  // 「恵比寿」「新宿」＝地名、「花火以外」＝ジャンル除外 で絞り込む。
  // 除外にマッチした部分は取り除いてから正のジャンル判定を行う
  // (「花火以外」が「花火」として二重にヒットしないように)。
  const excluded = detectExcludedCategory(text);
  const textForCategory = excluded ? text.replace(excluded.matched, "") : text;
  const window = detectWindow(text);
  const category = detectCategory(textForCategory);
  const area = detectArea(text);
  const intent = classify(text);
  const continuation = isContinuationText(text);
  let messages: LineMessage[];
  if (window || category || area || excluded || intent === "event" || continuation) {
    let filter: EventFilter = {
      window,
      category,
      area,
      excludeCategory: excluded?.filter ?? null,
    };
    // 「その中で」「他には」などの続き会話語があれば、今回指定されなかった
    // 次元だけ直前の絞り込み条件 (30分以内) を引き継ぐ。
    if (continuation) {
      const stored = await loadConversationState(admin, lineUserId);
      if (stored) filter = mergeWithContext(filter, stored);
    }
    // 連携済みなら興味・エリアで並べ替え。未連携は null で従来通り。
    const personal = await getPersonalization(admin, lineUserId);
    messages = await buildEventMessages(admin, filter, personal);
    await saveConversationState(admin, lineUserId, filter);
  } else if (intent === "keyword") {
    messages = [{ type: "text", text: KEYWORD_TEXT }];
  } else if (intent === "help") {
    messages = [{ type: "text", text: HELP_TEXT }];
  } else if (intent === "greeting") {
    messages = [{ type: "text", text: GREETING_TEXT }];
  } else {
    messages = [{ type: "text", text: FALLBACK_TEXT }];
  }

  await replyLineMessage(ev.replyToken, messages);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const events = payload.events ?? [];
  // LINE は 1 リクエストに複数イベントを載せることがある。
  await Promise.all(
    events.map(async (ev) => {
      try {
        if (ev.type === "follow") return await handleFollow(ev);
        if (ev.type === "unfollow") return await handleUnfollow(ev);
        if (ev.type === "message") return await handleMessage(ev);
      } catch (e) {
        console.error("line webhook event error", ev.type, e);
      }
    })
  );

  // 署名が正しい限り 200 を返す (LINE の検証・再送を避けるため)。
  return NextResponse.json({ ok: true });
}
