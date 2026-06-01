import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "プロフィール編集" };

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const initial = {
    display_name:
      profile?.display_name ?? user.email?.split("@")[0] ?? "",
    bio: (profile?.bio as string | null) ?? "",
    avatar_url: (profile?.avatar_url as string | null) ?? null,
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="mb-2 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        プロフィール編集
      </h1>
      <ProfileForm initial={initial} />
    </div>
  );
}
