"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isEventCategory } from "@/lib/events";

export type InterestState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; count: number };

export async function saveInterests(
  _prev: InterestState,
  formData: FormData
): Promise<InterestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/interests");
  }

  const raw = formData.getAll("category");
  const categories = raw
    .filter((v): v is string => typeof v === "string")
    .filter(isEventCategory);

  // 重複削除
  const unique = Array.from(new Set(categories));

  const { error } = await supabase
    .from("profiles")
    .update({ interest_categories: unique })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/me");
  revalidatePath("/me/interests");
  revalidatePath("/");
  return { status: "success", count: unique.length };
}
