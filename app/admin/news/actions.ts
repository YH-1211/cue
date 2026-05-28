"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { isEventCategory } from "@/lib/events";

export async function updateNews(id: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  const category = String(formData.get("category") ?? "");

  if (!title) throw new Error("タイトルは必須です");
  if (!isEventCategory(category)) throw new Error("カテゴリが不正です");

  const admin = createAdminClient();
  const { error } = await admin
    .from("news_items")
    .update({
      title,
      summary: summary || null,
      image_url: imageUrl || null,
      category,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/news");
  revalidatePath("/news");
}

export async function deleteNews(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("news_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/news");
  revalidatePath("/news");
}
