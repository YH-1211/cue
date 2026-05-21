"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function toggleSaveEvent(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
  }

  const { data: existing } = await supabase
    .from("saved_events")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("saved_events")
      .insert({ user_id: user.id, event_id: eventId });
    if (error) throw error;
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/me");
}
