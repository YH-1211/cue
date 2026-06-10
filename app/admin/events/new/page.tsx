import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AdminEventForm } from "./admin-event-form";

export const metadata = { title: "管理 / イベント作成" };
export const dynamic = "force-dynamic";

export default async function AdminNewEventPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          イベントを作成
        </h1>
        <p className="text-sm text-muted-foreground">
          公式ページの URL を貼って情報を取り込み、確認のうえ公開します。
          管理者が作成したイベントは承認済みとして即公開されます。
        </p>
      </header>

      <AdminEventForm />
    </div>
  );
}
