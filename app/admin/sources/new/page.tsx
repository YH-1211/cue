import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { SourceForm } from "../source-form";
import { createSource } from "../actions";

export const metadata = { title: "新規ソース追加" };
export const dynamic = "force-dynamic";

export default async function NewSourcePage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <Link
          href="/admin/sources"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← 一覧に戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          新規ソース追加
        </h1>
      </header>

      <SourceForm action={createSource} submitLabel="追加する" />
    </div>
  );
}
