"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";

export async function setHandled(id: string, handled: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("contact_messages").update({ handled }).eq("id", id);
  revalidatePath("/admin/contact");
}
