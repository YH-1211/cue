import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser, type PushPayload } from "@/lib/web-push";
import { sendLineToUser } from "@/lib/line";

/**
 * 1 ユーザーへ Web Push と LINE の両方へ同じ通知を配信する。
 * どちらか一方しか連携していないユーザーにも届く (iOS 非 PWA は LINE 側で受信)。
 * @returns 配信できたチャネル数の合計 (0 なら未達 = ログ・重複判定にも使える)
 */
export async function notifyUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  const [push, line] = await Promise.all([
    sendPushToUser(admin, userId, payload).catch((e) => {
      console.error("push deliver error", e);
      return 0;
    }),
    sendLineToUser(admin, userId, payload).catch((e) => {
      console.error("line deliver error", e);
      return 0;
    }),
  ]);
  return push + line;
}
