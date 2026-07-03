"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/moderation";

type Result = { ok: boolean; error?: string };

async function actorEmail(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "unknown";
}

// 通報を「対応済み」にする (コメントはそのまま)
export async function resolveReport(reportId: string): Promise<Result> {
  await requireAdmin();
  const email = await actorEmail();
  const admin = createAdminClient();

  const { error } = await admin
    .from("comment_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(admin, {
    actorEmail: email,
    action: "resolve_report",
    targetType: "report",
    targetId: reportId,
  });

  revalidatePath("/admin/reports");
  return { ok: true };
}

// 通報を「却下」にする (問題なしと判断)
export async function dismissReport(reportId: string): Promise<Result> {
  await requireAdmin();
  const email = await actorEmail();
  const admin = createAdminClient();

  const { error } = await admin
    .from("comment_reports")
    .update({ status: "dismissed" })
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction(admin, {
    actorEmail: email,
    action: "dismiss_report",
    targetType: "report",
    targetId: reportId,
  });

  revalidatePath("/admin/reports");
  return { ok: true };
}

// 通報されたコメントを削除し、その通報を対応済みにする
export async function deleteReportedComment(
  reportId: string,
  commentId: string
): Promise<Result> {
  await requireAdmin();
  const email = await actorEmail();
  const admin = createAdminClient();

  const { error: delError } = await admin
    .from("attended_comments")
    .delete()
    .eq("id", commentId);
  if (delError) return { ok: false, error: delError.message };

  // コメント削除で cascade により関連通報も消えるが、
  // 念のため残っていれば resolved にしておく (cascade 済みなら 0 行更新)。
  await admin
    .from("comment_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);

  await logAdminAction(admin, {
    actorEmail: email,
    action: "delete_comment",
    targetType: "comment",
    targetId: commentId,
    detail: `report ${reportId}`,
  });

  revalidatePath("/admin/reports");
  revalidatePath("/feed");
  return { ok: true };
}
