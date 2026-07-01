import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SubmitForm } from "./submit-form";

export const metadata = { title: "イベントを投稿" };

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/events/new");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          イベントを投稿
        </h1>
        <p className="text-sm text-muted-foreground">
          知っているイベントを Cue に登録しましょう。
          承認されると公開されます。
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-8">
        <SubmitForm />
      </div>
    </div>
  );
}
