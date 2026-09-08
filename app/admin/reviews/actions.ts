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
  const now = new Date().toISOString();

  const { data: flag } = await admin
    .from("event_review_flags")
    .update({ status, resolved_at: status === "open" ? null : now })
    .eq("id", id)
    .select("event_id")
    .single();

  // フラグを閉じた = 公式ソースと突き合わせてこのイベントを見直した、ということ。
  // その事実を verified_at に残すと、内容に変更が無くても stale_soon が鳴り止む。
  if (flag && status !== "open") {
    await admin
      .from("events")
      .update({ verified_at: now })
      .eq("id", flag.event_id);
  }

  revalidatePath("/admin/reviews");
}
