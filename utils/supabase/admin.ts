import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service Role 権限の Supabase クライアント。
 * RLS をバイパスするので、Server-only かつ Cron などサーバー処理からのみ呼ぶこと。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_URL が未設定です"
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
