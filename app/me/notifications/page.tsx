import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NotificationsClient } from "./notifications-client";

export const metadata = { title: "通知設定" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, subRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "notify_interest_weekly, notify_reminder_eve, notify_reminder_morning, notify_ticket"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
  ]);

  const prefs = profileRes.data ?? {
    notify_interest_weekly: true,
    notify_reminder_eve: true,
    notify_reminder_morning: true,
    notify_ticket: true,
  };
  const hasSubscription = (subRes.data?.length ?? 0) > 0;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-2 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">通知設定</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        この端末で通知を受け取るかどうかと、種類ごとの ON/OFF を設定できます。
      </p>

      <div className="mt-8">
        {vapidPublicKey ? (
          <NotificationsClient
            vapidPublicKey={vapidPublicKey}
            initialPrefs={prefs}
            hasSubscription={hasSubscription}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            通知機能は現在準備中です (VAPID キー未設定)。
          </div>
        )}
      </div>
    </div>
  );
}
