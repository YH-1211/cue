"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function followUser(targetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };
  if (user.id === targetId) return { ok: false, error: "自分はフォローできません" };

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, followee_id: targetId });
  // 既にフォロー済み (重複主キー) はエラー扱いしない
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/users/${targetId}`);
  revalidatePath("/me/follows");
  return { ok: true };
}

export async function unfollowUser(targetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "未ログイン" };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", targetId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/users/${targetId}`);
  revalidatePath("/me/follows");
  return { ok: true };
}
