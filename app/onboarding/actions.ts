"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isEventCategory } from "@/lib/events";
import { AREA_COORDS } from "@/lib/tokyo-areas";

function isAreaName(s: string | null | undefined): boolean {
  return !!s && Object.prototype.hasOwnProperty.call(AREA_COORDS, s);
}

export async function completeOnboarding(input: {
  categories: string[];
  homeArea: string | null;
  notifyNearby: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const categories = Array.from(
    new Set(input.categories.filter(isEventCategory))
  );
  const homeArea =
    input.homeArea && isAreaName(input.homeArea) ? input.homeArea : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      interest_categories: categories,
      home_area: homeArea,
      notify_nearby_match: homeArea ? input.notifyNearby : false,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

export async function skipOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
