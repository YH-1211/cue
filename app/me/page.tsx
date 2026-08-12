import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAdmin, isRootAdmin } from "@/lib/admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RankBadge } from "@/components/rank-badge";
import { BackButton } from "@/components/back-button";
import { SettingsMenu } from "./settings-menu";
import { isEventExpired } from "@/lib/datetime";
import type { EventCategory } from "@/lib/events";

export const metadata = { title: "マイページ" };

type SavedExpiryRow = {
  events: {
    starts_at: string | null;
    ends_at: string | null;
    is_permanent: boolean | null;
  } | null;
};

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileRes, savedRes, submittedCountRes, reportsCountRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url, points, interest_categories, bio")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("saved_events")
        .select(`events ( starts_at, ends_at, is_permanent )`)
        .eq("user_id", user.id),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("submitted_by", user.id)
        .eq("source_type", "user"),
      supabase
        .from("attended_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  const profile = profileRes.data;
  const points = profile?.points ?? 0;
  const interestCategories = (profile?.interest_categories ??
    []) as EventCategory[];

  // 行きたい件数は過去イベントを除いてカウント（一覧ページと同じ条件）
  const savedRows = (savedRes.data ?? []) as unknown as SavedExpiryRow[];
  const savedCount = savedRows
    .map((row) => row.events)
    .filter((e): e is NonNullable<SavedExpiryRow["events"]> => e !== null)
    .filter((e) => e.is_permanent || !isEventExpired(e.ends_at ?? e.starts_at))
    .length;

  const submittedCount = submittedCountRes.count ?? 0;
  const reportsCount = reportsCountRes.count ?? 0;

  const admin = await isAdmin();
  const root = admin ? await isRootAdmin() : false;
  let pendingCount = 0;
  if (admin) {
    const { count } = await createAdminClient()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("approved", false);
    pendingCount = count ?? 0;
  }

  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "ゲスト";
  const initial = displayName.charAt(0).toUpperCase();
  const lineAddFriendUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL;

  const contentLinks = [
    { href: "/me/saved", icon: "♡", label: "行きたいイベント", count: savedCount },
    { href: "/me/submitted", icon: "📮", label: "投稿したイベント", count: submittedCount },
    { href: "/me/reports", icon: "📸", label: "行ったイベント", count: reportsCount },
    { href: "/me/points", icon: "🏆", label: "ランク・ポイント", count: null },
    { href: "/me/interests", icon: "🏷", label: "興味タグ", count: interestCategories.length },
  ] as const;

  const settingsLinks = [
    { href: "/me/profile", icon: "🙍", label: "プロフィールを編集" },
    { href: "/me/notifications", icon: "🔔", label: "通知設定" },
    { href: "/settings/appearance", icon: "🎨", label: "表示・テーマ" },
    { href: "/me/saved-searches", icon: "🔖", label: "保存した検索" },
    { href: "/me/follows", icon: "👥", label: "フォロー" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-sm">
        <BackButton fallbackHref="/" label="戻る" />
      </nav>

      <header className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile?.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt="" />
          )}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {displayName}
          </h1>
          {profile?.bio ? (
            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {profile.bio}
            </p>
          ) : (
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          )}
          <div className="mt-1.5">
            <RankBadge points={points} />
          </div>
        </div>
        <div className="shrink-0">
          <SettingsMenu admin={admin} root={root} pendingCount={pendingCount} />
        </div>
      </header>

      <nav className="mt-8 flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        {contentLinks.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className={
              "flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted " +
              (i > 0 ? "border-t border-border" : "")
            }
          >
            <span aria-hidden className="w-5 text-center text-base">
              {l.icon}
            </span>
            <span className="flex-1 font-medium">{l.label}</span>
            {l.count != null && (
              <span className="tabular-nums text-xs text-muted-foreground">
                {l.count} 件
              </span>
            )}
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        ))}
      </nav>

      <h2 className="mb-2 mt-8 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        設定
      </h2>
      <nav className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        {settingsLinks.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className={
              "flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted " +
              (i > 0 ? "border-t border-border" : "")
            }
          >
            <span aria-hidden className="w-5 text-center text-base">
              {l.icon}
            </span>
            <span className="flex-1 font-medium">{l.label}</span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        ))}
      </nav>

      <h2 className="mb-2 mt-8 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        その他
      </h2>
      <nav className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        {lineAddFriendUrl && (
          <a
            href={lineAddFriendUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted"
          >
            <span aria-hidden className="w-5 text-center text-base">
              💬
            </span>
            <span className="flex-1 font-medium">
              Cue 公式 LINE を友だち追加
            </span>
            <span className="text-[#06C755]">↗</span>
          </a>
        )}
        {[
          { href: "/terms", label: "利用規約" },
          { href: "/privacy", label: "プライバシーポリシー" },
          { href: "/contact", label: "お問い合わせ" },
          { href: "/credits", label: "画像クレジット" },
        ].map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            className={
              "flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted " +
              (i > 0 || lineAddFriendUrl ? "border-t border-border" : "")
            }
          >
            <span className="flex-1">{l.label}</span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
