"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/admin";

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
