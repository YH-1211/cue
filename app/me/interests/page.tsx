import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { InterestForm } from "./interest-form";

export const metadata = { title: "興味タグ" };

export default async function InterestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/interests");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("interest_categories")
    .eq("id", user.id)
    .maybeSingle();

  const selected =
    (profile?.interest_categories as string[] | null | undefined) ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <Link
          href="/me"
          className="text-muted-foreground hover:text-foreground"
        >
          ← マイページに戻る
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          興味タグ
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          選んだカテゴリのイベントがホームで優先表示されます。
        </p>
      </header>

      <InterestForm initialSelected={selected} />
    </div>
  );
}
