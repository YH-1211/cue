import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "ようこそ" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("interest_categories, home_area")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <OnboardingWizard
      initialCategories={(profile?.interest_categories ?? []) as string[]}
      initialHomeArea={profile?.home_area ?? null}
    />
  );
}
