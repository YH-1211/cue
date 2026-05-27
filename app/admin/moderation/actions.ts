"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/admin";

export async function approveEvent(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({ approved: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/moderation");
}

export async function rejectEvent(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/moderation");
}
