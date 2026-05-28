"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendPushToUser } from "@/lib/web-push";

export type SubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function saveSubscription(
  sub: SubscriptionJSON,
  userAgent: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  // 同じ endpoint があれば更新、なければ作成
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/notifications");
  return { ok: true };
}

export async function removeSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/notifications");
  return { ok: true };
}

export type NotificationPrefs = {
  notify_interest_weekly: boolean;
  notify_reminder_eve: boolean;
  notify_reminder_morning: boolean;
  notify_ticket: boolean;
};

export type HomeAreaSettings = {
  home_area: string | null;
  home_radius_km: number;
  notify_nearby_match: boolean;
};

export async function updateHomeArea(input: HomeAreaSettings) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  const radius = Math.max(1, Math.min(30, Math.round(input.home_radius_km)));

  const { error } = await supabase
    .from("profiles")
    .update({
      home_area: input.home_area || null,
      home_radius_km: radius,
      notify_nearby_match: input.notify_nearby_match,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/notifications");
  return { ok: true };
}

export async function updatePreferences(prefs: NotificationPrefs) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  const { error } = await supabase
    .from("profiles")
    .update(prefs)
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me/notifications");
  return { ok: true };
}

export async function sendTestNotification() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  const admin = createAdminClient();
  try {
    const count = await sendPushToUser(admin, user.id, {
      title: "Cue テスト通知",
      body: "通知が届きました。設定はこのまま有効です。",
      url: "/me/notifications",
      tag: "test",
    });
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "送信失敗" };
  }
}
