"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { logAdminAction } from "@/lib/moderation";

export type ProfileState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export type DeleteState =
  | { status: "idle" }
  | { status: "error"; message: string };

const MAX_NAME_LEN = 30;
const MAX_BIO_LEN = 160;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/profile");
  }

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const bio = (formData.get("bio") as string | null)?.trim() ?? "";

  if (!displayName) {
    return { status: "error", message: "表示名を入力してください。" };
  }
  if (displayName.length > MAX_NAME_LEN) {
    return {
      status: "error",
      message: `表示名は ${MAX_NAME_LEN} 文字以内で入力してください。`,
    };
  }
  if (bio.length > MAX_BIO_LEN) {
    return {
      status: "error",
      message: `自己紹介は ${MAX_BIO_LEN} 文字以内で入力してください。`,
    };
  }

  const update: {
    display_name: string;
    bio: string | null;
    avatar_url?: string;
  } = {
    display_name: displayName,
    bio: bio || null,
  };

  // アバター画像 (任意)
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (!ALLOWED_MIME.has(avatar.type)) {
      return {
        status: "error",
        message: `対応していない画像形式です: ${avatar.type || "不明"}`,
      };
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      return {
        status: "error",
        message: `画像サイズは ${Math.floor(MAX_AVATAR_BYTES / 1024 / 1024)}MB 以下にしてください。`,
      };
    }
    const ext = extFromMime(avatar.type);
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, avatar, { contentType: avatar.type, upsert: true });
    if (upErr) {
      return { status: "error", message: `画像アップロード失敗: ${upErr.message}` };
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    update.avatar_url = pub.publicUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/me");
  revalidatePath("/me/profile");
  revalidatePath(`/users/${user.id}`);
  return { status: "success" };
}

// 退会: 本人が自分のアカウントとデータを完全に削除する。
// ログアウト (セッションを切るだけ) とは別で、auth ユーザーごと消す
// → profiles / 保存・コメント等 FK cascade で紐づくデータも消える。取り消し不可。
export async function deleteMyAccount(
  _prev: DeleteState,
  formData: FormData
): Promise<DeleteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/me/profile");
  }

  // 誤操作防止: 「退会」と入力しないと進めない
  const confirm = (formData.get("confirm") as string | null)?.trim() ?? "";
  if (confirm !== "退会") {
    return {
      status: "error",
      message: "確認のため「退会」と入力してください。",
    };
  }

  const admin = createAdminClient();

  // 監査ログ (uuid のみ・個人情報は残さない)。削除で本人データが消える前に記録
  await logAdminAction(admin, {
    actorEmail: "self",
    action: "self_delete_account",
    targetUserId: user.id,
    targetType: "user",
    targetId: user.id,
    detail: null,
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      status: "error",
      message: `退会処理に失敗しました: ${error.message}`,
    };
  }

  // 消えたユーザーのセッションを破棄してトップへ
  await supabase.auth.signOut();
  redirect("/?goodbye=1");
}
