"use server";

import { createClient } from "@/utils/supabase/server";

const THEMES = ["light", "dark", "system"] as const;
const ACCENTS = ["violet", "orange", "blue", "teal", "pink", "green"] as const;

type Theme = (typeof THEMES)[number];
type Accent = (typeof ACCENTS)[number];

// ログインユーザーの表示設定を DB に保存して端末間で同期する。
// ゲスト (未ログイン) は localStorage のみで運用するため、ここでは何もしない。
export async function saveAppearance(theme: Theme, accent: Accent) {
  if (!THEMES.includes(theme) || !ACCENTS.includes(accent)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ theme, accent })
    .eq("id", user.id);
}
