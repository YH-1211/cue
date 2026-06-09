"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin, rootAdminEmails } from "@/lib/admin";

export type AddAdminState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addAdmin(
  _prev: AddAdminState,
  formData: FormData
): Promise<AddAdminState> {
  await requireAdmin();

  const raw = formData.get("email");
  const email = (typeof raw === "string" ? raw : "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "メールアドレスの形式が正しくありません。" };
  }
  if (rootAdminEmails().includes(email)) {
    return {
      status: "error",
      message: "このメールは環境変数のルート管理者として既に登録されています。",
    };
  }

  // 追加者を記録 (任意)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_users")
    .upsert({ email, added_by: user?.email ?? null }, { onConflict: "email" });

  if (error) {
    return { status: "error", message: `追加に失敗しました: ${error.message}` };
  }

  revalidatePath("/admin/admins");
  return { status: "success", email };
}

export async function removeAdmin(email: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_users")
    .delete()
    .eq("email", email.toLowerCase());
  if (error) throw new Error(error.message);
  revalidatePath("/admin/admins");
}
