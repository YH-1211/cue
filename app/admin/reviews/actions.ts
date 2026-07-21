"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";

// 要確認フラグのステータスを更新する (resolved = 対応済み / ignored = 無視 / open = 差し戻し)
export async function setFlagStatus(
  id: string,
  status: "open" | "resolved" | "ignored"
) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("event_review_flags")
    .update({
      status,
      resolved_at: status === "open" ? null : new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin/reviews");
}
