"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/admin";

// 管理者がイベント詳細ページからアフィリエイトリンクを登録/解除する。
// 空文字を渡すと解除 (NULL) になり、チケットボタンは通常の ticket_url に戻る。
export async function setAffiliateUrl(
  id: string,
  url: string
): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const trimmed = url.trim();
  if (trimmed) {
    if (!/^https?:\/\//i.test(trimmed)) {
      return { ok: false, message: "http(s):// から始まるURLを入力してください。" };
    }
    if (trimmed.length > 1000) {
      return { ok: false, message: "URLが長すぎます (1000文字以内)。" };
    }
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({ affiliate_url: trimmed || null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/events/${id}`);
  return { ok: true };
}

// 管理者がイベント詳細ページから直接イベントを削除する。
export async function deleteEventFromDetail(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/events");
}
