"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isEventCategory } from "@/lib/events";
import { jstLocalToIso } from "@/lib/datetime";
import { extractEventFromUrl } from "@/lib/extract-event";

const MAX_URLS = 20;

export type BulkDraft = {
  url: string;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  area: string;
  address: string;
  official_url: string;
  cover_image_url: string;
  is_free: string;
};

export type BulkExtractRow =
  | { url: string; ok: true; draft: BulkDraft }
  | { url: string; ok: false; error: string };

// 複数 URL をまとめて抽出し、編集可能な下書きに変換して返す (管理者専用)。
export async function extractBulkUrls(urls: string[]): Promise<BulkExtractRow[]> {
  await requireAdmin();
  const clean = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(
    0,
    MAX_URLS
  );
  return Promise.all(
    clean.map(async (url): Promise<BulkExtractRow> => {
      const r = await extractEventFromUrl(url);
      if (!r.ok) return { url, ok: false, error: r.error };
      const d = r.data;
      return {
        url,
        ok: true,
        draft: {
          url,
          title: d.title ?? "",
          description: d.description ?? "",
          category: d.category ?? "",
          starts_at: d.startsAt ?? "",
          ends_at: d.endsAt ?? "",
          venue_name: d.venueName ?? "",
          area: "",
          address: d.address ?? "",
          official_url: url,
          cover_image_url: d.coverImageUrl ?? "",
          is_free:
            d.isFree === true ? "free" : d.isFree === false ? "paid" : "",
        },
      };
    })
  );
}

export type PublishResult = {
  inserted: number;
  errors: { label: string; message: string }[];
};

// 選択された下書きをまとめて events に挿入 (approved:true 即公開)。
// 1件ごとに検証し、不正な行はスキップしてエラーとして報告する。
export async function publishBulkEvents(
  drafts: BulkDraft[]
): Promise<PublishResult> {
  await requireAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const errors: { label: string; message: string }[] = [];
  const rows: Record<string, unknown>[] = [];
  const now = Date.now();
  let i = 0;

  for (const d of drafts) {
    const title = d.title.trim();
    const label = title || d.url;
    if (!title) {
      errors.push({ label: d.url, message: "タイトルが空" });
      continue;
    }
    if (!isEventCategory(d.category)) {
      errors.push({ label, message: "カテゴリ未選択" });
      continue;
    }
    const startsIso = jstLocalToIso(d.starts_at);
    if (!startsIso) {
      errors.push({ label, message: "開催日時が未入力／不正" });
      continue;
    }
    const officialUrl = d.official_url.trim();
    if (!/^https?:\/\//i.test(officialUrl)) {
      errors.push({ label, message: "公式URLが不正" });
      continue;
    }
    rows.push({
      title,
      description: d.description.trim() || null,
      starts_at: startsIso,
      ends_at: jstLocalToIso(d.ends_at),
      venue_name: d.venue_name.trim() || null,
      address: d.address.trim() || null,
      area: d.area.trim() || null,
      category: d.category,
      cover_image_url: d.cover_image_url.trim() || null,
      official_url: officialUrl,
      is_free:
        d.is_free === "free" ? true : d.is_free === "paid" ? false : null,
      source_type: "user",
      source_id: `admin-bulk-${now}-${i++}`,
      submitted_by: user?.id ?? null,
      approved: true,
    });
  }

  if (rows.length) {
    const { error } = await admin.from("events").insert(rows);
    if (error) {
      return {
        inserted: 0,
        errors: [...errors, { label: "DB", message: error.message }],
      };
    }
    revalidatePath("/events");
  }
  return { inserted: rows.length, errors };
}
