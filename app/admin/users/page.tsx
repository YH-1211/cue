import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "./user-actions";

export const metadata = { title: "管理 / 利用者" };
export const dynamic = "force-dynamic";

type Status = "active" | "warned" | "banned";

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  points: number;
  status: Status;
  moderation_reason: string | null;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

const STATUS_META: Record<Status, { label: string; className: string }> = {
  active: { label: "通常", className: "bg-emerald-600 text-white" },
  warned: { label: "警告", className: "bg-amber-500 text-white" },
  banned: { label: "ブロック", className: "bg-red-600 text-white" },
};

export default async function AdminUsersPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, display_name, avatar_url, bio, points, status, moderation_reason, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const profiles = (data ?? []) as ProfileRow[];

  // 投稿イベント数・コメント数を集計 (件数が多くない前提でまとめて取得)
  const [{ data: eventRows }, { data: commentRows }] = await Promise.all([
    admin.from("events").select("submitted_by").not("submitted_by", "is", null),
    admin.from("attended_comments").select("user_id"),
  ]);

  const eventCount = new Map<string, number>();
  for (const r of (eventRows ?? []) as { submitted_by: string | null }[]) {
    if (r.submitted_by)
      eventCount.set(r.submitted_by, (eventCount.get(r.submitted_by) ?? 0) + 1);
  }
  const commentCount = new Map<string, number>();
  for (const r of (commentRows ?? []) as { user_id: string }[]) {
    commentCount.set(r.user_id, (commentCount.get(r.user_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </nav>

      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">利用者</h1>
        <p className="text-sm text-muted-foreground">
          ログインしたユーザーのプロフィール一覧です。荒らし等には警告・ブロック・削除ができます。
          （メールアドレスなどの個人情報は表示しません）
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          取得エラー: {error.message}
        </div>
      )}

      <p className="mb-3 text-xs text-muted-foreground">
        {profiles.length} 人
      </p>

      <ul className="flex flex-col gap-3">
        {profiles.map((p) => {
          const name = p.display_name ?? "ゲスト";
          const initial = name.charAt(0).toUpperCase();
          const meta = STATUS_META[p.status] ?? STATUS_META.active;
          return (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar className="size-11 shrink-0">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{name}</span>
                    <Badge className={`${meta.className} hover:${meta.className}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  {p.bio && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {p.bio}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.points} pt ・ 投稿 {eventCount.get(p.id) ?? 0} 件 ・
                    コメント {commentCount.get(p.id) ?? 0} 件 ・{" "}
                    {dateFormatter.format(new Date(p.created_at))} 登録
                  </p>
                  {p.moderation_reason && (
                    <p className="mt-1 text-xs text-amber-600">
                      理由: {p.moderation_reason}
                    </p>
                  )}
                </div>
              </div>
              <UserActions userId={p.id} status={p.status} name={name} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
