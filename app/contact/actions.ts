"use server";

import { createClient } from "@/utils/supabase/server";

export type ContactState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      values: { name: string; email: string; category: string; body: string };
    }
  | { status: "success" };

const CATEGORIES = new Set(["bug", "request", "event", "account", "other"]);
const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_BODY = 4000;
// シンプルなメール形式チェック（厳密さより誤入力検知が目的）
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name = readString(formData, "name");
  const email = readString(formData, "email");
  const category = readString(formData, "category") || "other";
  const body = readString(formData, "body");

  const values = { name, email, category, body };

  if (!name) {
    return { status: "error", message: "お名前を入力してください。", values };
  }
  if (name.length > MAX_NAME) {
    return {
      status: "error",
      message: `お名前は ${MAX_NAME} 文字以内で入力してください。`,
      values,
    };
  }
  if (!email || !EMAIL_RE.test(email) || email.length > MAX_EMAIL) {
    return {
      status: "error",
      message: "メールアドレスの形式が正しくありません。",
      values,
    };
  }
  if (!CATEGORIES.has(category)) {
    return { status: "error", message: "種別が不正です。", values };
  }
  if (!body) {
    return {
      status: "error",
      message: "お問い合わせ内容を入力してください。",
      values,
    };
  }
  if (body.length > MAX_BODY) {
    return {
      status: "error",
      message: `お問い合わせ内容は ${MAX_BODY} 文字以内で入力してください。`,
      values,
    };
  }

  const supabase = await createClient();
  // ログイン中なら誰からの問い合わせか紐づける（任意）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("contact_messages").insert({
    user_id: user?.id ?? null,
    name,
    email,
    category,
    body,
  });

  if (error) {
    return {
      status: "error",
      message: `送信に失敗しました: ${error.message}`,
      values,
    };
  }

  return { status: "success" };
}
