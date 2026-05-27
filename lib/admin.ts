// 管理者判定
// - ADMIN_EMAIL 環境変数に登録したメアドのユーザーのみ admin
// - 複数指定はカンマ区切り対応

import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";

function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAIL ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const allowed = adminEmails();
  if (allowed.length === 0) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return allowed.includes(user.email.toLowerCase());
}

// admin でなければ 404 (admin URL の存在を漏らさない)
export async function requireAdmin(): Promise<void> {
  const ok = await isAdmin();
  if (!ok) notFound();
}
