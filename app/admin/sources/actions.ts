"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { isEventCategory } from "@/lib/events";
import { ingestSource, type IngestSource } from "@/lib/ingest";

const KINDS = ["rss", "atom", "ical", "json"] as const;
const TARGETS = ["events", "news_items"] as const;

type SourceInput = {
  name: string;
  kind: (typeof KINDS)[number];
  url: string;
  category_default: string;
  area_default: string | null;
  target_table: (typeof TARGETS)[number];
  enabled: boolean;
  auto_approve: boolean;
  include_pattern: string | null;
  exclude_pattern: string | null;
};

function parseForm(formData: FormData): SourceInput {
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category_default") ?? "");
  const area = String(formData.get("area_default") ?? "").trim();
  const targetRaw = String(formData.get("target_table") ?? "events");
  const enabled = formData.get("enabled") === "on";
  const autoApprove = formData.get("auto_approve") === "on";
  const include = String(formData.get("include_pattern") ?? "").trim();
  const exclude = String(formData.get("exclude_pattern") ?? "").trim();

  if (!name) throw new Error("名前は必須です");
  if (!url) throw new Error("URL は必須です");
  if (!(KINDS as readonly string[]).includes(kindRaw)) {
    throw new Error("kind が不正です");
  }
  if (!isEventCategory(category)) {
    throw new Error("カテゴリが不正です");
  }
  if (!(TARGETS as readonly string[]).includes(targetRaw)) {
    throw new Error("target_table が不正です");
  }

  return {
    name,
    kind: kindRaw as (typeof KINDS)[number],
    url,
    category_default: category,
    area_default: area || null,
    target_table: targetRaw as (typeof TARGETS)[number],
    enabled,
    auto_approve: autoApprove,
    include_pattern: include || null,
    exclude_pattern: exclude || null,
  };
}

export async function createSource(formData: FormData) {
  await requireAdmin();
  const input = parseForm(formData);
  const admin = createAdminClient();
  const { error } = await admin.from("event_sources").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}

export async function updateSource(id: string, formData: FormData) {
  await requireAdmin();
  const input = parseForm(formData);
  const admin = createAdminClient();
  const { error } = await admin
    .from("event_sources")
    .update(input)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sources");
  revalidatePath(`/admin/sources/${id}/edit`);
  redirect("/admin/sources");
}

export async function toggleSource(id: string, enabled: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("event_sources")
    .update({ enabled })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sources");
}

export async function deleteSource(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("event_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/sources");
}

// 手動で 1 ソースだけ即時取り込み
export async function runSourceNow(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("ソースが見つかりません");

  const startedAt = new Date().toISOString();
  try {
    const count = await ingestSource(admin, data as IngestSource);
    await admin
      .from("event_sources")
      .update({
        last_run_at: startedAt,
        last_status: "ok",
        last_count: count,
        last_error: null,
      })
      .eq("id", id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("event_sources")
      .update({
        last_run_at: startedAt,
        last_status: "error",
        last_count: 0,
        last_error: msg.slice(0, 500),
      })
      .eq("id", id);
    throw new Error(msg);
  }
  revalidatePath("/admin/sources");
}
