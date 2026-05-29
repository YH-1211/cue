import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "フォロー" };

type ProfileLite = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

function UserRow({ p }: { p: ProfileLite }) {
  const name = p.display_name || "名無しさん";
  return (
    <li>
      <Link
        href={`/users/${p.id}`}
        className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
      >
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.avatar_url}
            alt=""
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
            {name.slice(0, 1)}
          </div>
        )}
        <span className="text-sm font-medium">{name}</span>
      </Link>
    </li>
  );
}

export default async function FollowsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [followingRes, followersRes] = await Promise.all([
    supabase
      .from("follows")
      .select("profiles!follows_followee_id_fkey ( id, display_name, avatar_url )")
      .eq("follower_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows")
      .select("profiles!follows_follower_id_fkey ( id, display_name, avatar_url )")
      .eq("followee_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const following = ((followingRes.data ?? []) as unknown as Array<{
    profiles: ProfileLite | null;
  }>)
    .map((r) => r.profiles)
    .filter((p): p is ProfileLite => !!p);
  const followers = ((followersRes.data ?? []) as unknown as Array<{
    profiles: ProfileLite | null;
  }>)
    .map((r) => r.profiles)
    .filter((p): p is ProfileLite => !!p);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-2 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">フォロー</h1>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          フォロー中 ({following.length})
        </h2>
        {following.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            まだ誰もフォローしていません。
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {following.map((p) => (
              <UserRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          フォロワー ({followers.length})
        </h2>
        {followers.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだフォロワーはいません。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {followers.map((p) => (
              <UserRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
