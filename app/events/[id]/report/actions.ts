"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type ReportState =
  | { status: "idle" }
  | { status: "error"; message: string; values?: { memo: string; rating: string; attended_on: string } }
  | { status: "success"; attendedEventId: string };

const MAX_MEMO_LEN = 2000;
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
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

function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function submitReport(
  eventId: string,
  _prev: ReportState,
  formData: FormData
): Promise<ReportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/events/${eventId}/report`);
  }

  // イベント存在 + 公開チェック
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, starts_at, ends_at, approved")
    .eq("id", eventId)
    .maybeSingle();

  if (eventErr || !event) {
    return { status: "error", message: "イベントが見つかりません。" };
  }
  if (!event.approved) {
    return {
      status: "error",
      message: "公開前のイベントにはレポートを投稿できません。",
    };
  }

  const memo = readString(formData, "memo");
  const ratingRaw = readString(formData, "rating");
  const attendedOnRaw = readString(formData, "attended_on");

  const values = { memo, rating: ratingRaw, attended_on: attendedOnRaw };

  if (memo.length > MAX_MEMO_LEN) {
    return {
      status: "error",
      message: `感想は ${MAX_MEMO_LEN} 文字以内で入力してください。`,
      values,
    };
  }

  let rating: number | null = null;
  if (ratingRaw) {
    const n = Number(ratingRaw);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return {
        status: "error",
        message: "評価は 1〜5 の整数で指定してください。",
        values,
      };
    }
    rating = n;
  }

  let attendedOn: string;
  if (attendedOnRaw) {
    const d = new Date(attendedOnRaw);
    if (Number.isNaN(d.getTime())) {
      return {
        status: "error",
        message: "参加日の形式が正しくありません。",
        values,
      };
    }
    attendedOn = attendedOnRaw;
  } else {
    // デフォルトは終了日 (なければ開始日)。JST 暦日で算出 (UTC だと早朝開催が前日になる)。
    attendedOn = new Date(event.ends_at ?? event.starts_at).toLocaleDateString(
      "sv-SE",
      { timeZone: "Asia/Tokyo" }
    );
  }

  // 写真ファイル取り出し
  const rawFiles = formData.getAll("photos");
  const files: File[] = [];
  for (const f of rawFiles) {
    if (f instanceof File && f.size > 0) files.push(f);
  }

  if (files.length > MAX_PHOTOS) {
    return {
      status: "error",
      message: `写真は最大 ${MAX_PHOTOS} 枚までです。`,
      values,
    };
  }

  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return {
        status: "error",
        message: `対応していない画像形式です: ${file.type || "不明"}`,
        values,
      };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return {
        status: "error",
        message: `画像サイズは 1 枚あたり ${Math.floor(MAX_PHOTO_BYTES / 1024 / 1024)}MB 以下にしてください。`,
        values,
      };
    }
  }

  // attended_events を upsert (同一ユーザー × 同一イベントは 1 件)
  const { data: attended, error: attendedErr } = await supabase
    .from("attended_events")
    .upsert(
      {
        user_id: user.id,
        event_id: eventId,
        memo: memo || null,
        rating,
        attended_on: attendedOn,
      },
      { onConflict: "user_id,event_id" }
    )
    .select("id")
    .single();

  if (attendedErr || !attended) {
    return {
      status: "error",
      message: attendedErr?.message ?? "レポート保存に失敗しました。",
      values,
    };
  }

  const attendedId: string = attended.id;

  // 写真をアップロード
  const uploadedPaths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = extFromMime(file.type);
    const path = `${user.id}/${attendedId}/${Date.now()}-${i}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("event-reports")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (upErr) {
      return {
        status: "error",
        message: `画像アップロード失敗: ${upErr.message}`,
        values,
      };
    }
    uploadedPaths.push(path);
  }

  if (uploadedPaths.length > 0) {
    const photoRows = uploadedPaths.map((p) => ({
      attended_event_id: attendedId,
      storage_path: p,
    }));
    const { error: photoErr } = await supabase
      .from("attended_photos")
      .insert(photoRows);

    if (photoErr) {
      return {
        status: "error",
        message: `写真情報の保存に失敗: ${photoErr.message}`,
        values,
      };
    }
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/me");
  return { status: "success", attendedEventId: attendedId };
}
