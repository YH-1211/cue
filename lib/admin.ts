// 管理者判定
// - ADMIN_EMAIL 環境変数に登録したメアド (ルート管理者 / 削除不可)
// - もしくは admin_users テーブルに登録されたメアド (画面から追加)
// - いずれも複数指定/複数行に対応

import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";

// 環境変数のルート管理者一覧 (小文字正規化)
export function rootAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAIL ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return false;

  // ルート管理者 (環境変数)
  if (rootAdminEmails().includes(email)) return true;

  // DB 管理者 (admin_users)。RLS により自分の行のみ参照できる。
  const { data } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

// admin でなければ 404 (admin URL の存在を漏らさない)
export async function requireAdmin(): Promise<void> {
  const ok = await isAdmin();
  if (!ok) notFound();
}
