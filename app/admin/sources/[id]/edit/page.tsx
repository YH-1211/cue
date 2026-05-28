import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { SourceForm, type SourceFormDefaults } from "../../source-form";
import { updateSource } from "../../actions";

export const metadata = { title: "ソース編集" };
export const dynamic = "force-dynamic";

export default async function EditSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const defaults: SourceFormDefaults = {
    name: data.name,
    kind: data.kind,
    url: data.url,
    category_default: data.category_default,
    area_default: data.area_default,
    target_table: data.target_table,
    enabled: data.enabled,
    auto_approve: data.auto_approve,
    include_pattern: data.include_pattern,
    exclude_pattern: data.exclude_pattern,
  };

  const updateAction = updateSource.bind(null, id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <Link
          href="/admin/sources"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← 一覧に戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">ソース編集</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.name}</p>
      </header>

      <SourceForm
        defaults={defaults}
        action={updateAction}
        submitLabel="保存する"
      />
    </div>
  );
}
