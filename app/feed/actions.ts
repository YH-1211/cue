"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isBanned } from "@/lib/moderation";

export async function toggleLike(attendedEventId: string, liked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  if (liked) {
    // 解除
    const { error } = await supabase
      .from("attended_likes")
      .delete()
      .eq("user_id", user.id)
      .eq("attended_event_id", attendedEventId);
    if (error) return { ok: false, error: error.message };
  } else {
    // 追加 (重複しても primary key で防がれる)
    const { error } = await supabase.from("attended_likes").insert({
      user_id: user.id,
      attended_event_id: attendedEventId,
    });
    if (error && !error.message.includes("duplicate")) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/feed");
  return { ok: true, liked: !liked };
}

export type FeedComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function fetchComments(
  attendedEventId: string
): Promise<{ ok: boolean; comments?: FeedComment[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attended_comments")
    .select(
      `id, body, created_at, user_id,
       profiles!attended_comments_user_id_fkey ( display_name, avatar_url )`
    )
    .eq("attended_event_id", attendedEventId)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const comments: FeedComment[] = (data ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      display_name: string | null;
      avatar_url: string | null;
    } | null;
    return {
      id: row.id as string,
      body: row.body as string,
      created_at: row.created_at as string,
      user_id: row.user_id as string,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
  return { ok: true, comments };
}

export async function addComment(attendedEventId: string, body: string) {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "コメントを入力してください" };
  if (trimmed.length > 500)
    return { ok: false, error: "コメントは500文字以内で入力してください" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  // BAN されたユーザーはコメント不可 (RLS でも弾かれるが、先に分かりやすいエラーを返す)
  if (await isBanned(supabase, user.id)) {
    return {
      ok: false,
      error: "アカウントが制限されているためコメントできません",
    };
  }

  const { data, error } = await supabase
    .from("attended_comments")
    .insert({
      attended_event_id: attendedEventId,
      user_id: user.id,
      body: trimmed,
    })
    .select(
      `id, body, created_at, user_id,
       profiles!attended_comments_user_id_fkey ( display_name, avatar_url )`
    )
    .single();

  if (error) return { ok: false, error: error.message };

  const profile = data.profiles as unknown as {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  const comment: FeedComment = {
    id: data.id as string,
    body: data.body as string,
    created_at: data.created_at as string,
    user_id: data.user_id as string,
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
  };

  revalidatePath("/feed");
  return { ok: true, comment };
}

export async function reportComment(commentId: string, reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  if (await isBanned(supabase, user.id)) {
    return { ok: false, error: "アカウントが制限されています" };
  }

  const trimmed = reason.trim().slice(0, 300);

  const { error } = await supabase.from("comment_reports").insert({
    comment_id: commentId,
    reporter_id: user.id,
    reason: trimmed || null,
  });

  // 同じコメントを重複通報した場合 (unique 制約違反) は成功扱いにする
  if (error && !error.message.includes("duplicate")) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("attended_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/feed");
  return { ok: true };
}
