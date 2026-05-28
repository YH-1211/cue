import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { NotificationsClient } from "./notifications-client";
import { HomeAreaSection } from "./home-area-section";

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
        "notify_interest_weekly, notify_reminder_eve, notify_reminder_morning, notify_ticket, home_area, home_radius_km, notify_nearby_match"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1),
  ]);

  const profile = profileRes.data ?? null;
  const prefs = {
    notify_interest_weekly: profile?.notify_interest_weekly ?? true,
    notify_reminder_eve: profile?.notify_reminder_eve ?? true,
    notify_reminder_morning: profile?.notify_reminder_morning ?? true,
    notify_ticket: profile?.notify_ticket ?? true,
  };
  const homeAreaInitial = {
    home_area: (profile?.home_area as string | null) ?? null,
    home_radius_km: (profile?.home_radius_km as number | null) ?? 5,
    notify_nearby_match: profile?.notify_nearby_match ?? true,
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

      <div className="mt-8 flex flex-col gap-6">
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

        <HomeAreaSection initial={homeAreaInitial} />
      </div>
    </div>
  );
}
