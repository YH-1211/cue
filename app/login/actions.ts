"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "success"; email: string }
  | { status: "error"; message: string };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  if (typeof rawEmail !== "string") {
    return { status: "error", message: "メールアドレスを入力してください。" };
  }
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      status: "error",
      message: "メールアドレスの形式が正しくありません。",
    };
  }

  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "success", email };
}

export type OAuthResult = { url?: string; error?: string };

export async function signInWithGoogle(): Promise<OAuthResult> {
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  if (data?.url) return { url: data.url };
  return { error: "認証URLの取得に失敗しました" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
