import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPayload } from "@/lib/web-push";

const LINE_API = "https://api.line.me/v2/bot";
const PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || "https://cue-taupe-eight.vercel.app";

function channelSecret(): string {
  const s = process.env.LINE_CHANNEL_SECRET;
  if (!s) throw new Error("LINE_CHANNEL_SECRET が未設定です");
  return s;
}

function accessToken(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です");
  return t;
}

/**
 * Webhook の署名を検証する。
 * LINE は x-line-signature に base64(HMAC-SHA256(channelSecret, rawBody)) を付ける。
 * rawBody は加工前の生文字列を渡すこと (JSON.parse したものを再文字列化しない)。
 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", channelSecret())
    .update(rawBody)
    .digest("base64");
  // 長さが違うと timingSafeEqual が投げるので先に長さチェック
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export type LineTextMessage = { type: "text"; text: string };
// Flex Message の中身 (bubble/carousel) は複雑なので型は緩めに持つ。
// altText はプッシュ通知・トーク一覧のプレビューに使われるので必須。
export type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};
export type LineMessage = LineTextMessage | LineFlexMessage;

/** replyToken を使って応答する (無料・友だちが発言した直後のみ有効)。 */
export async function replyLineMessage(
  replyToken: string,
  messages: LineMessage[]
): Promise<boolean> {
  const res = await fetch(`${LINE_API}/message/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    console.error("line reply error", res.status, await res.text());
    return false;
  }
  return true;
}

/** 任意のタイミングで userId 宛に push する (フリープランは月あたり通数制限あり)。 */
export async function pushLineMessage(
  to: string,
  messages: LineMessage[]
): Promise<boolean> {
  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    console.error("line push error", res.status, await res.text());
    return false;
  }
  return true;
}

/** 友だち全員へ一斉配信する (broadcast)。無料プランでは通数が受信者数分カウントされる。 */
export async function broadcastLineMessage(
  messages: LineMessage[]
): Promise<boolean> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return false;
  const res = await fetch(`${LINE_API}/message/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    console.error("line broadcast error", res.status, await res.text());
    return false;
  }
  return true;
}

/** PushPayload を LINE のテキスト 1 通に整形する。URL があれば末尾に絶対URLで付ける。 */
function payloadToLineText(payload: PushPayload): string {
  const lines = [payload.title, payload.body].filter(Boolean);
  if (payload.url) {
    const url = payload.url.startsWith("http")
      ? payload.url
      : `${PUBLIC_ORIGIN}${payload.url}`;
    lines.push(url);
  }
  return lines.join("\n");
}

/**
 * 1 ユーザーへ LINE 通知を送る。
 * profiles.line_user_id が未連携 / notify_via_line=false なら 0 を返す。
 * Web Push (sendPushToUser) と同じ payload を受け取り、横並びで配信できる。
 * @returns 送信できたら 1、それ以外 0
 */
export async function sendLineToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return 0;

  const { data: profile, error } = await admin
    .from("profiles")
    .select("line_user_id, notify_via_line")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile?.line_user_id || profile.notify_via_line === false) {
    return 0;
  }

  const ok = await pushLineMessage(profile.line_user_id, [
    { type: "text", text: payloadToLineText(payload) },
  ]);
  return ok ? 1 : 0;
}
