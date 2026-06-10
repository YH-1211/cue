import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { BulkForm } from "./bulk-form";

export const metadata = { title: "管理 / イベント一括投入" };
export const dynamic = "force-dynamic";

export default async function AdminBulkEventPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          イベントを一括投入
        </h1>
        <p className="text-sm text-muted-foreground">
          複数の公式ページ URL（1行に1つ、最大20件）をまとめて貼ると、
          それぞれの情報を取り込み、確認・修正のうえ一括で公開できます。
        </p>
      </header>

      <BulkForm />
    </div>
  );
}
