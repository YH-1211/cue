import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@cue.app";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys が未設定です");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
};

/**
 * 1 ユーザーの全 push_subscription に通知を送る。
 * 410/404 (購読切れ) は subscription を削除する。
 * @returns 送信成功数
 */
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  ensureConfigured();

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let success = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
        success += 1;
      } catch (e: unknown) {
        const status =
          typeof e === "object" && e !== null && "statusCode" in e
            ? (e as { statusCode: number }).statusCode
            : 0;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("push send error", status, e);
        }
      }
    })
  );

  return success;
}

/**
 * ADMIN_EMAIL に登録された管理者全員へ push 通知を送る。
 * メールアドレスは user_ids_by_email RPC で user_id に解決する。
 * @returns 送信成功数
 */
export async function sendPushToAdmins(
  admin: SupabaseClient,
  payload: PushPayload
): Promise<number> {
  const emails = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (emails.length === 0) return 0;

  const { data: ids, error } = await admin.rpc("user_ids_by_email", {
    p_emails: emails,
  });
  if (error || !ids || ids.length === 0) return 0;

  let success = 0;
  await Promise.all(
    (ids as { id: string }[]).map(async ({ id }) => {
      success += await sendPushToUser(admin, id, payload);
    })
  );
  return success;
}
