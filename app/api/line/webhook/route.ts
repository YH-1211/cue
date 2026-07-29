import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyLineSignature, replyLineMessage } from "@/lib/line";

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

const WELCOME =
  "Cue の友だち追加ありがとう！🎉\n" +
  "興味・エリアに合わせたイベント通知を LINE で受け取るには、アカウント連携が必要やで。\n\n" +
  "Cue アプリの「通知設定」でLINE連携コードを発行して、そのコードをこのトークに送ってな。";

// メッセージ本文から連携コードらしき英数字列 (4〜10文字) を取り出す。
function extractCode(text: string): string | null {
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length >= 4 && normalized.length <= 10) return normalized;
  return null;
}

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

  const code = extractCode(text);
  if (!code) {
    await replyLineMessage(ev.replyToken, [
      {
        type: "text",
        text:
          "連携するには、Cue アプリの「通知設定」で発行したコードを送ってな。\n" +
          "コードが分からんときは Cue アプリを開いてみて！",
      },
    ]);
    return;
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // 未使用・未期限切れのコードを探す。
  const { data: link } = await admin
    .from("line_link_codes")
    .select("code, user_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (!link || link.used_at || new Date(link.expires_at) < new Date()) {
    await replyLineMessage(ev.replyToken, [
      {
        type: "text",
        text: "コードが無効か期限切れやわ。Cue アプリでもう一度発行してな。",
      },
    ]);
    return;
  }

  // 既に他のアカウントがこの LINE を使っていたら外してから付け替える。
  await admin
    .from("profiles")
    .update({ line_user_id: null })
    .eq("line_user_id", lineUserId)
    .neq("id", link.user_id);

  const { error: updErr } = await admin
    .from("profiles")
    .update({ line_user_id: lineUserId, notify_via_line: true })
    .eq("id", link.user_id);

  if (updErr) {
    await replyLineMessage(ev.replyToken, [
      { type: "text", text: "連携中にエラーが出たわ。少し待ってもう一度試してな。" },
    ]);
    return;
  }

  await admin
    .from("line_link_codes")
    .update({ used_at: nowIso })
    .eq("code", code);

  await replyLineMessage(ev.replyToken, [
    {
      type: "text",
      text:
        "連携できたで！✅\n" +
        "これからは興味・エリアに合ったイベントを LINE でお届けするな。\n" +
        "通知はいつでも Cue アプリの設定でオフにできるで。",
    },
  ]);
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
