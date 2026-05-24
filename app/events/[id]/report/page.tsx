import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ReportForm } from "./report-form";

export const metadata = { title: "感想を投稿" };

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/events/${id}/report`);
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, approved")
    .eq("id", id)
    .maybeSingle();

  if (!event || !event.approved) {
    notFound();
  }

  // 既存レポートがあれば編集用に取得 (memo, rating, attended_on)
  const { data: existing } = await supabase
    .from("attended_events")
    .select("id, memo, rating, attended_on")
    .eq("user_id", user.id)
    .eq("event_id", id)
    .maybeSingle();

  const defaultAttendedOn =
    existing?.attended_on ??
    new Date(event.ends_at ?? event.starts_at).toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <Link
          href={`/events/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← イベントに戻る
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          行ってきた / 感想を投稿
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          写真と感想をシェアして、これから参加する人の参考にしましょう。
          {existing && (
            <span className="ml-1 text-foreground">
              既存のレポートを更新します（同じ内容で上書き）。
            </span>
          )}
        </p>
      </header>

      <ReportForm
        eventId={id}
        eventTitle={event.title}
        defaultAttendedOn={defaultAttendedOn}
      />
    </div>
  );
}
