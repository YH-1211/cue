"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/moderation";

type Result = { ok: boolean; error?: string };

// 操作している管理者のメアド (監査ログ用)
async function actorEmail(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "unknown";
}

// 警告: status を warned にし、理由を残す
export async function warnUser(
  userId: string,
  reason: string
): Promise<Result> {
  await requireAdmin();
  const email = await actorEmail();
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      status: "warned",
      moderation_reason: reason.trim() || null,
      moderated_at: new Date().toISOString(),
      moderated_by: email,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  await logAdminAction(admin, {
    actorEmail: email,
    action: "warn_user",
    targetUserId: userId,
    targetType: "user",
    targetId: userId,
    detail: reason.trim() || null,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ブロック: status を banned にする (投稿・コメントが DB 側で止まる)
export async function banUser(userId: string, reason: string): Promise<Result> {
  await requireAdmin();
  const email = await actorEmail();
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      status: "banned",
      moderation_reason: reason.trim() || null,
      moderated_at: new Date().toISOString(),
      moderated_by: email,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  await logAdminAction(admin, {
    actorEmail: email,
    action: "ban_user",
    targetUserId: userId,
    targetType: "user",
    targetId: userId,
    detail: reason.trim() || null,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ブロック解除: status を active に戻す
export async function unbanUser(userId: string): Promise<Result> {
  await requireAdmin();
  const email = await actorEmail();
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      status: "active",
      moderation_reason: null,
      moderated_at: new Date().toISOString(),
      moderated_by: email,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  await logAdminAction(admin, {
    actorEmail: email,
    action: "unban_user",
    targetUserId: userId,
    targetType: "user",
    targetId: userId,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// アカウント削除: auth.users ごと削除 (profiles 等は cascade で消える)。
// 監査ログは target_user_id に FK が無いので削除後も残る。
export async function deleteUser(
  userId: string,
  reason: string
): Promise<Result> {
  await requireAdmin();
  const email = await actorEmail();
  const admin = createAdminClient();

  // 先に監査ログを書く (削除でユーザー情報が消えても履歴を残すため)
  await logAdminAction(admin, {
    actorEmail: email,
    action: "delete_user",
    targetUserId: userId,
    targetType: "user",
    targetId: userId,
    detail: reason.trim() || null,
  });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}
