import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { formatRelativeTime } from "@/lib/relative-time";
import { ReportActions } from "./report-actions";

export const metadata = { title: "管理 / 通報" };
export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  comment_id: string;
  reporter_id: string;
  reason: string | null;
  created_at: string;
};

export default async function AdminReportsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("comment_reports")
    .select("id, comment_id, reporter_id, reason, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);

  const reports = (data ?? []) as ReportRow[];

  // 通報対象コメント本文と、関係者名をまとめて取得
  const commentIds = [...new Set(reports.map((r) => r.comment_id))];
  const { data: commentRows } = commentIds.length
    ? await admin
        .from("attended_comments")
        .select("id, body, user_id")
        .in("id", commentIds)
    : { data: [] as { id: string; body: string; user_id: string }[] };

  const comments = new Map(
    ((commentRows ?? []) as { id: string; body: string; user_id: string }[]).map(
      (c) => [c.id, c]
    )
  );

  const nameIds = [
    ...new Set([
      ...reports.map((r) => r.reporter_id),
      ...Array.from(comments.values()).map((c) => c.user_id),
    ]),
  ];
  const { data: profileRows } = nameIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", nameIds)
    : { data: [] as { id: string; display_name: string | null }[] };

  const names = new Map(
    ((profileRows ?? []) as { id: string; display_name: string | null }[]).map(
      (p) => [p.id, p.display_name ?? "ゲスト"]
    )
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </nav>

      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">通報</h1>
        <p className="text-sm text-muted-foreground">
          利用者から通報されたコメントの一覧です。内容を確認して対応してください。
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          取得エラー: {error.message}
        </div>
      )}

      {reports.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          未対応の通報はありません。
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {reports.map((r) => {
          const comment = comments.get(r.comment_id);
          const commenterName = comment
            ? names.get(comment.user_id) ?? "ゲスト"
            : "（削除済み）";
          return (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="text-xs text-muted-foreground">
                {names.get(r.reporter_id) ?? "ゲスト"} が通報 ・{" "}
                {formatRelativeTime(r.created_at)}
                {r.reason ? ` ・ 理由: ${r.reason}` : ""}
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="mb-1 text-xs font-semibold">{commenterName}</p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {comment ? comment.body : "このコメントは既に削除されています。"}
                </p>
              </div>
              {comment && (
                <ReportActions reportId={r.id} commentId={r.comment_id} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
