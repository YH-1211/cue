import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { BackButton } from "@/components/back-button";
import { SavedSearchList, type SavedSearch } from "./saved-search-list";

export const metadata = { title: "保存した検索" };

export default async function SavedSearchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/saved-searches");

  const { data } = await supabase
    .from("saved_searches")
    .select(
      "id, label, q, categories, areas, free_only, evening_only, notify, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const searches = (data ?? []) as SavedSearch[];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <BackButton fallbackHref="/me" label="戻る" />
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">保存した検索</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          条件に合う新着イベントが追加されると通知でお知らせします。
        </p>
      </header>

      {searches.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          まだ保存した検索はありません。
          <br />
          <Link
            href="/search"
            className="mt-2 inline-block text-foreground underline underline-offset-2"
          >
            検索画面で条件を保存する
          </Link>
        </div>
      ) : (
        <SavedSearchList searches={searches} />
      )}
    </div>
  );
}
