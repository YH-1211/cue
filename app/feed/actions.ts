"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function toggleLike(attendedEventId: string, liked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  if (liked) {
    // 解除
    const { error } = await supabase
      .from("attended_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("attended_event_id", attendedEventId);
    if (error) return { ok: false, error: error.message };
  } else {
    // 追加 (重複しても primary key で防がれる)
    const { error } = await supabase.from("attended_likes").insert({
      user_id: user.id,
      attended_event_id: attendedEventId,
    });
    if (error && !error.message.includes("duplicate")) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/feed");
  return { ok: true, liked: !liked };
}
