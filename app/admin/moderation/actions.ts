"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/admin";

// イベント承認時に投稿者へ付与するポイント
const APPROVAL_POINTS = 10;

// 投稿者に加算 (admin クライアントは RLS を通らないので points を更新できる)。
async function awardPoints(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  amount: number
) {
  const { data } = await admin
    .from("profiles")
    .select("points")
    .eq("id", userId)
    .maybeSingle();
  const current = data?.points ?? 0;
  await admin
    .from("profiles")
    .update({ points: current + amount })
    .eq("id", userId);
}

export async function approveEvent(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  // 未承認 → 承認 に変わった行だけ取得 (再承認での二重付与を防ぐ)
  const { data, error } = await admin
    .from("events")
    .update({ approved: true })
    .eq("id", id)
    .eq("approved", false)
    .select("submitted_by")
    .maybeSingle();
  if (error) throw new Error(error.message);

  // 投稿者がいれば +10pt (運営作成イベントは submitted_by=null なので対象外)
  if (data?.submitted_by) {
    await awardPoints(admin, data.submitted_by, APPROVAL_POINTS);
    revalidatePath(`/users/${data.submitted_by}`);
  }
  revalidatePath("/admin/moderation");
  revalidatePath("/me");
}

export async function rejectEvent(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/moderation");
}

// 公開済み (承認済み) イベントの削除
export async function deleteEvent(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/moderation");
  revalidatePath("/events");
  revalidatePath("/");
}
