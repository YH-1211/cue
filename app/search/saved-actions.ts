"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  isEventCategory,
  isParentCategory,
  categoriesUnderParent,
} from "@/lib/events";

export type SaveSearchInput = {
  label: string;
  q: string;
  category: string;
  areas: string[];
  free: boolean;
  evening: boolean;
};

export async function saveSearch(
  input: SaveSearchInput
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const label = input.label.trim().slice(0, 60);
  if (!label) return { ok: false, error: "名前を入力してください" };

  // category (親/サブ) を実際の category 配列に展開
  let categories: string[] = [];
  if (input.category && isEventCategory(input.category)) {
    categories = isParentCategory(input.category)
      ? categoriesUnderParent(input.category)
      : [input.category];
  }
  const areas = input.areas.filter(Boolean);

  const { error } = await supabase.from("saved_searches").insert({
    user_id: user.id,
    label,
    q: input.q.trim() || null,
    categories,
    areas,
    free_only: input.free,
    evening_only: input.evening,
    notify: true,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/saved-searches");
  return { ok: true };
}

export async function deleteSavedSearch(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/saved-searches");
  return { ok: true };
}

export async function toggleSavedSearchNotify(
  id: string,
  notify: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("saved_searches")
    .update({ notify })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/saved-searches");
  return { ok: true };
}
