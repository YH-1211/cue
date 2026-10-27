"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

// 未ログイン中に端末へ貯めた「行きたい」を、ログイン後にアカウントへ移す。
// 既に保存済みのものは ignoreDuplicates で素通りさせる。
export async function mergeLocalSaves(
  eventIds: string[],
): Promise<{ merged: number }> {
  const ids = [...new Set(eventIds)].filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  if (ids.length === 0) return { merged: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { merged: 0 };

  // 存在しない / 非公開のイベント ID が混ざっていても外部キーで落ちないよう、
  // 実在する公開イベントだけに絞ってから入れる。
  const { data: valid } = await supabase
    .from("events")
    .select("id")
    .eq("approved", true)
    .in("id", ids);

  const validIds = (valid ?? []).map((e: { id: string }) => e.id);
  if (validIds.length === 0) return { merged: 0 };

  const { error } = await supabase
    .from("saved_events")
    .upsert(
      validIds.map((event_id) => ({ user_id: user.id, event_id })),
      { onConflict: "user_id,event_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[mergeLocalSaves] upsert failed:", error);
    return { merged: 0 };
  }

  revalidatePath("/me/saved");
  revalidatePath("/me");
  return { merged: validIds.length };
}
