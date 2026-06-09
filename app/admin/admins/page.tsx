import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRootAdmin, rootAdminEmails } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { AddForm } from "./add-form";
import { RemoveButton } from "./remove-button";

export const metadata = { title: "管理 / 管理者" };
export const dynamic = "force-dynamic";

type AdminRow = {
  email: string;
  added_by: string | null;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

export default async function AdminAdminsPage() {
  try {
    await requireRootAdmin();
  } catch {
    redirect("/me");
  }

  const roots = rootAdminEmails();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("email, added_by, created_at")
    .order("created_at", { ascending: false });

  const added = (data ?? []) as AdminRow[];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </nav>

      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">管理者</h1>
        <p className="text-sm text-muted-foreground">
          管理者権限を持つユーザーを管理します。
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">管理者を追加</h2>
        <AddForm />
      </section>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          取得エラー: {error.message}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {roots.map((email) => (
          <li
            key={`root-${email}`}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <span className="text-sm font-medium">{email}</span>
            <Badge variant="secondary">ルート (環境変数)</Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              削除不可
            </span>
          </li>
        ))}

        {added.map((row) => (
          <li
            key={row.email}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <span className="text-sm font-medium">{row.email}</span>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              追加済み
            </Badge>
            <span className="text-xs text-muted-foreground">
              {row.added_by ? `${row.added_by} が追加` : "追加者不明"} ・{" "}
              {dateFormatter.format(new Date(row.created_at))}
            </span>
            <span className="ml-auto">
              <RemoveButton email={row.email} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
