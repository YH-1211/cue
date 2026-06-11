"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isEventCategory } from "@/lib/events";
import { jstLocalToIso } from "@/lib/datetime";
import { extractEventFromUrl } from "@/lib/extract-event";
import type { FetchUrlResult } from "@/components/events/event-form";

// URL を1本受け取り、ページからイベント情報を抽出してフォーム自動入力用に返す。
// ログインユーザーのみ (投稿者しか叩かないので軽い保護)。
export async function fetchEventFromUrl(url: string): Promise<FetchUrlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "ログインが必要です。" };
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return { status: "error", message: "URL を入力してください。" };
  }
  const result = await extractEventFromUrl(trimmed);
  if (!result.ok) {
    return { status: "error", message: result.error };
  }
  return { status: "success", data: result.data };
}

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; message: string; values?: Record<string, string> }
  | { status: "success"; eventId: string };

const MAX_TITLE_LEN = 120;
const MAX_DESCRIPTION_LEN = 4000;
const MAX_URL_LEN = 500;

function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function submitEvent(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/events/new");
  }

  const title = readString(formData, "title");
  const description = readString(formData, "description");
  const category = readString(formData, "category");
  const startsAt = readString(formData, "starts_at");
  const endsAt = readString(formData, "ends_at");
  const venueName = readString(formData, "venue_name");
  const address = readString(formData, "address");
  const area = readString(formData, "area");
  const officialUrl = readString(formData, "official_url");
  const coverImageUrl = readString(formData, "cover_image_url");
  const ticketSaleStartsAt = readString(formData, "ticket_sale_starts_at");
  const isFreeRaw = readString(formData, "is_free");
  const isFree =
    isFreeRaw === "free" ? true : isFreeRaw === "paid" ? false : null;

  const values = {
    title,
    description,
    category,
    starts_at: startsAt,
    ends_at: endsAt,
    venue_name: venueName,
    address,
    area,
    official_url: officialUrl,
    cover_image_url: coverImageUrl,
    ticket_sale_starts_at: ticketSaleStartsAt,
    is_free: isFreeRaw,
  };

  if (!title) {
    return { status: "error", message: "タイトルを入力してください。", values };
  }
  if (title.length > MAX_TITLE_LEN) {
    return {
      status: "error",
      message: `タイトルは ${MAX_TITLE_LEN} 文字以内で入力してください。`,
      values,
    };
  }
  if (description.length > MAX_DESCRIPTION_LEN) {
    return {
      status: "error",
      message: `説明は ${MAX_DESCRIPTION_LEN} 文字以内で入力してください。`,
      values,
    };
  }
  if (!isEventCategory(category)) {
    return {
      status: "error",
      message: "カテゴリを選択してください。",
      values,
    };
  }
  if (!startsAt) {
    return { status: "error", message: "開催日時を入力してください。", values };
  }
  const startsAtIso = jstLocalToIso(startsAt);
  if (!startsAtIso) {
    return {
      status: "error",
      message: "開催日時の形式が正しくありません。",
      values,
    };
  }
  let endsAtIso: string | null = null;
  if (endsAt) {
    endsAtIso = jstLocalToIso(endsAt);
    if (!endsAtIso) {
      return {
        status: "error",
        message: "終了日時の形式が正しくありません。",
        values,
      };
    }
    if (endsAtIso < startsAtIso) {
      return {
        status: "error",
        message: "終了日時は開催日時より後を指定してください。",
        values,
      };
    }
  }
  let ticketSaleIso: string | null = null;
  if (ticketSaleStartsAt) {
    ticketSaleIso = jstLocalToIso(ticketSaleStartsAt);
    if (!ticketSaleIso) {
      return {
        status: "error",
        message: "チケット発売日時の形式が正しくありません。",
        values,
      };
    }
  }
  if (!officialUrl) {
    return { status: "error", message: "公式URLを入力してください。", values };
  }
  if (!/^https?:\/\//i.test(officialUrl) || officialUrl.length > MAX_URL_LEN) {
    return {
      status: "error",
      message: "公式URLは http(s):// から始まる正しいURLを入力してください。",
      values,
    };
  }
  if (coverImageUrl) {
    if (
      !/^https?:\/\//i.test(coverImageUrl) ||
      coverImageUrl.length > MAX_URL_LEN
    ) {
      return {
        status: "error",
        message:
          "カバー画像URLは http(s):// から始まる正しいURLを入力してください。",
        values,
      };
    }
  }

  // source_id は user 投稿の重複防止用 (user-uuid-timestamp)
  const sourceId = `user-${user.id}-${Date.now()}`;

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      description: description || null,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      venue_name: venueName || null,
      address: address || null,
      area: area || null,
      category,
      cover_image_url: coverImageUrl || null,
      official_url: officialUrl,
      ticket_sale_starts_at: ticketSaleIso,
      is_free: isFree,
      source_type: "user",
      source_id: sourceId,
      submitted_by: user.id,
      approved: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: error?.message ?? "投稿に失敗しました。",
      values,
    };
  }

  revalidatePath("/me");
  revalidatePath("/events");
  return { status: "success", eventId: data.id };
}
