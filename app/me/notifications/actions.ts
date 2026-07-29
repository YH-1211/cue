"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { notifyUser } from "@/lib/notify";

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
  notify_interest_upcoming: boolean;
  notify_interest_ticket: boolean;
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

export type QuietHoursSettings = {
  notify_quiet_hours_enabled: boolean;
  notify_quiet_hours_start: number;
  notify_quiet_hours_end: number;
  notify_interest_min_score: number;
};

export async function updateQuietHours(input: QuietHoursSettings) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  const clampHour = (h: number) => Math.max(0, Math.min(23, Math.round(h)));
  const allowedScores = [0.5, 1.0, 2.0];
  const score = allowedScores.includes(input.notify_interest_min_score)
    ? input.notify_interest_min_score
    : 1.0;

  const { error } = await supabase
    .from("profiles")
    .update({
      notify_quiet_hours_enabled: input.notify_quiet_hours_enabled,
      notify_quiet_hours_start: clampHour(input.notify_quiet_hours_start),
      notify_quiet_hours_end: clampHour(input.notify_quiet_hours_end),
      notify_interest_min_score: score,
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

// 紛らわしい文字 (0/O, 1/I/L) を除いた英数字でコードを作る。
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeLinkCode(len = 6): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * LINE 連携用の一時コードを発行する。
 * 既存の未使用コードは破棄し、10 分有効な新コードを 1 つ返す。
 */
export async function generateLineLinkCode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "未ログイン" };

  const admin = createAdminClient();

  // 古いコードを掃除 (未使用のもの)。
  await admin
    .from("line_link_codes")
    .delete()
    .eq("user_id", user.id)
    .is("used_at", null);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // 衝突しても数回リトライ (実質ほぼ起きない)。
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeLinkCode();
    const { error } = await admin.from("line_link_codes").insert({
      code,
      user_id: user.id,
      expires_at: expiresAt,
    });
    if (!error) {
      return { ok: true as const, code, expiresAt };
    }
  }
  return { ok: false as const, error: "コード発行に失敗しました" };
}

/** LINE 連携を解除する。 */
export async function unlinkLine() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "未ログイン" };

  const { error } = await supabase
    .from("profiles")
    .update({ line_user_id: null })
    .eq("id", user.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/me/notifications");
  return { ok: true as const };
}

/** LINE 通知の ON/OFF を切り替える (連携は維持したまま)。 */
export async function updateLineNotify(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "未ログイン" };

  const { error } = await supabase
    .from("profiles")
    .update({ notify_via_line: enabled })
    .eq("id", user.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/me/notifications");
  return { ok: true as const };
}

export async function sendTestNotification() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  const admin = createAdminClient();
  try {
    const count = await notifyUser(admin, user.id, {
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
