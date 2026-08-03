import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventCategory } from "@/lib/events";

// 保存履歴学習: 過去90日に保存したイベントの category 分布から重みを返す
//   重み = (そのカテゴリの保存数 / 全保存数) * 2  (最大2点程度のブースト)
// notify cron の週次おすすめ・LINE bot の返信スコアリングの双方で使う共通ロジック。
export async function learnCategoryWeights(
  admin: SupabaseClient,
  userId: string
): Promise<Partial<Record<EventCategory, number>>> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("saved_events")
    .select("events!inner ( category )")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (!data || data.length === 0) return {};

  const counts: Partial<Record<EventCategory, number>> = {};
  let total = 0;
  for (const row of data as unknown as Array<{ events: { category: EventCategory } | null }>) {
    const cat = row.events?.category;
    if (!cat) continue;
    counts[cat] = (counts[cat] ?? 0) + 1;
    total += 1;
  }
  if (total === 0) return {};

  const weights: Partial<Record<EventCategory, number>> = {};
  for (const [cat, n] of Object.entries(counts)) {
    weights[cat as EventCategory] = ((n as number) / total) * 2;
  }
  return weights;
}
