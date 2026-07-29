import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyLineSignature, replyLineMessage } from "@/lib/line";
import { startOfTodayJstIso } from "@/lib/datetime";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LINE Webhook イベントの必要最小限の型。
type LineSource = { type: string; userId?: string };
type LineEvent = {
  type: string;
  replyToken?: string;
  source?: LineSource;
  message?: { type: string; text?: string };
};

// 連携コードで使う文字 (actions.ts の CODE_ALPHABET と一致させること)。
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

const WELCOME =
  "Cue の友だち追加ありがとう！🎉\n" +
  "東京・関東のイベントが見つかるアプリ「Cue」やで。\n\n" +
  "このトークでできること👇\n" +
  "・「イベント」→ 近々の開催をお届け\n" +
  "・「使い方」→ アプリの説明\n\n" +
  "さらに、興味・エリアに合わせた通知を LINE で受け取るには連携が必要やで。" +
  "Cue アプリの「通知設定」で連携コードを発行して、ここに送ってな！\n\n" +
  SITE.url;

// ---- 意図判定 ----------------------------------------------------------

type Intent = "event" | "help" | "greeting" | "unknown";

const EVENT_WORDS = [
  "イベント", "いべんと", "近く", "ちかく", "近所", "週末", "おすすめ",
  "オススメ", "やってる", "催し", "フェス", "祭り", "まつり", "予定", "何かある",
  "なにかある",
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

function classify(text: string): Intent {
  const t = text.toLowerCase();
  if (EVENT_WORDS.some((w) => t.includes(w.toLowerCase()))) return "event";
  if (HELP_WORDS.some((w) => t.includes(w.toLowerCase()))) return "help";
  if (GREETING_WORDS.some((w) => t.includes(w.toLowerCase()))) return "greeting";
  return "unknown";
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

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function buildEventReply(admin: SupabaseClient): Promise<string> {
  const { data } = await admin
    .from("events")
    .select("id, title, starts_at, area")
    .eq("approved", true)
    .gte("effective_end", startOfTodayJstIso())
    .order("starts_at", { ascending: true })
    .limit(5);

  const events = data ?? [];
  if (events.length === 0) {
    return (
      "いま公開中の直近イベントが見つからへんかったわ🙏\n" +
      "アプリで探してみて → " +
      SITE.url +
      "/search"
    );
  }

  const lines = events.map((e) => {
    const place = e.area ? ` / ${e.area}` : "";
    return `・${e.title}\n  📅 ${formatJst(e.starts_at)}${place}\n  ${SITE.url}/events/${e.id}`;
  });

  return (
    "近々のイベントやで！👇\n\n" +
    lines.join("\n\n") +
    "\n\nもっと見る → " +
    SITE.url +
    "/search"
  );
}

const HELP_TEXT =
  "Cue は東京・関東のイベントが見つかるアプリやで！🎪\n\n" +
  "🔍 ジャンル・エリアで検索\n" +
  "📍 興味と現在地に合わせたおすすめ通知\n" +
  "🎟️ チケット発売・締切のリマインド\n" +
  "⭐ 気になるイベントを保存\n\n" +
  "アプリはこちら → " +
  SITE.url +
  "\n\n「イベント」と送ってくれたら、近々の開催を教えるで！";

const GREETING_TEXT =
  "やあ！Cue やで🐾\n" +
  "「イベント」で近々の開催、「使い方」でアプリの説明をするで。";

const FALLBACK_TEXT =
  "うまく聞き取れへんかったわ🙏\n\n" +
  "・「イベント」→ 近々の開催を教えるで\n" +
  "・「使い方」→ アプリの説明\n" +
  "・連携コード → アカウント連携\n\n" +
  "って送ってみて！";

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

async function handleMessage(ev: LineEvent) {
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
            "連携できたで！✅\n" +
            "これからは興味・エリアに合ったイベントを LINE でお届けするな。\n" +
            "通知はいつでも Cue アプリの設定でオフにできるで。",
        },
      ]);
      return;
    }
    if (result === "expired") {
      await replyLineMessage(ev.replyToken, [
        {
          type: "text",
          text: "コードが無効か期限切れやわ。Cue アプリでもう一度発行してな。",
        },
      ]);
      return;
    }
    // "notacode" → 通常会話として続行
  }

  // 2) 意図判定して返信。
  const intent = classify(text);
  let reply: string;
  if (intent === "event") {
    reply = await buildEventReply(admin);
  } else if (intent === "help") {
    reply = HELP_TEXT;
  } else if (intent === "greeting") {
    reply = GREETING_TEXT;
  } else {
    reply = FALLBACK_TEXT;
  }

  await replyLineMessage(ev.replyToken, [{ type: "text", text: reply }]);
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
