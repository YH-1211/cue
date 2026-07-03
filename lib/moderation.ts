// モデレーション共通ヘルパー
// - 監査ログ (admin_actions) への記録
// - ユーザーの BAN 判定
// いずれも service role クライアントを受け取り、RLS をバイパスして書き込む。
// 呼び出し側は必ず requireAdmin() を通ってから使うこと。

import type { SupabaseClient } from "@supabase/supabase-js";

export type ModerationStatus = "active" | "warned" | "banned";

// 監査ログの action 種別 (フリーテキストだが型で揺れを防ぐ)
export type AdminAction =
  | "warn_user"
  | "ban_user"
  | "unban_user"
  | "delete_user"
  | "resolve_report"
  | "dismiss_report"
  | "delete_comment";

export type LogActionInput = {
  actorEmail: string;
  action: AdminAction;
  targetUserId?: string | null;
  targetType?: "user" | "comment" | "report" | "event" | null;
  targetId?: string | null;
  detail?: string | null;
};

// 管理者操作を admin_actions に記録する。失敗しても本処理は止めない
// (監査ログの書き込み失敗で管理操作自体を巻き戻す必要はないため)。
export async function logAdminAction(
  admin: SupabaseClient,
  input: LogActionInput
): Promise<void> {
  await admin.from("admin_actions").insert({
    actor_email: input.actorEmail,
    action: input.action,
    target_user_id: input.targetUserId ?? null,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    detail: input.detail ?? null,
  });
}

// 指定ユーザーが banned かどうかを返す。
// 通常クライアント (RLS) でも自分の profiles は読めるので、
// server action 内で auth ユーザーの id を渡して使う。
export async function isBanned(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();
  return (data?.status as ModerationStatus | undefined) === "banned";
}
