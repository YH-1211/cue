import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  type EventCategory,
} from "@/lib/events";
import { RankBadge } from "@/components/rank-badge";
import { FollowButton } from "../follow-button";

export const metadata = { title: "ユーザー" };

type AttendedRow = {
  id: string;
  memo: string | null;
  rating: number | null;
  attended_on: string | null;
  created_at: string;
  events: {
    id: string;
    title: string;
    category: EventCategory;
    venue_name: string | null;
    area: string | null;
  } | null;
};

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, points")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const [followersRes, followingRes, attendedRes, viewerFollowRes] =
    await Promise.all([
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("followee_id", id),
      supabase
        .from("follows")
        .select("followee_id", { count: "exact", head: true })
        .eq("follower_id", id),
      supabase
        .from("attended_events")
        .select(
          `id, memo, rating, attended_on, created_at,
           events!inner ( id, title, category, venue_name, area, approved )`
        )
        .eq("user_id", id)
        .eq("events.approved", true)
        .order("created_at", { ascending: false })
        .limit(10),
      viewer && viewer.id !== id
        ? supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", viewer.id)
            .eq("followee_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const followers = followersRes.count ?? 0;
  const following = followingRes.count ?? 0;
  const attended = (attendedRes.data ?? []) as unknown as AttendedRow[];
  const isFollowing = !!viewerFollowRes.data;
  const isSelf = viewer?.id === id;
  const name = profile.display_name || "名無しさん";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-start gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-muted text-xl font-bold text-muted-foreground">
            {name.slice(0, 1)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{name}</h1>
            <RankBadge points={profile.points ?? 0} compact />
          </div>
          <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{followers}</span>{" "}
              フォロワー
            </span>
            <span>
              <span className="font-semibold text-foreground">{following}</span>{" "}
              フォロー中
            </span>
          </div>
        </div>
        {viewer && !isSelf && (
          <FollowButton targetId={id} initialFollowing={isFollowing} />
        )}
        {isSelf && (
          <Link
            href="/me"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            マイページ
          </Link>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">
        参加したイベント
      </h2>

      {attended.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          まだ参加記録がありません。
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {attended.map((a) => {
            const ev = a.events;
            if (!ev) return null;
            return (
              <li key={a.id}>
                <Link href={`/events/${ev.id}`} className="group block">
                  <Card className="transition-shadow group-hover:shadow-md">
                    <CardContent className="flex flex-col gap-1.5 p-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={categoryBadgeClass(
                            ev.category as EventCategory
                          )}
                        >
                          {CATEGORY_LABELS[ev.category]}
                        </Badge>
                        {a.rating != null && (
                          <span className="text-xs text-amber-500">
                            {"★".repeat(a.rating)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold leading-snug">
                        {ev.title}
                      </h3>
                      {(ev.area || ev.venue_name) && (
                        <p className="text-sm text-muted-foreground">
                          {ev.area && `${ev.area} / `}
                          {ev.venue_name}
                        </p>
                      )}
                      {a.memo && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {a.memo}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
