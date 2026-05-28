import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { NewsRow, type NewsRowData } from "./news-row";

export const metadata = { title: "管理 / ニュース" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  const { category } = await searchParams;

  const admin = createAdminClient();
  let q = admin
    .from("news_items")
    .select(
      "id, title, summary, image_url, category, source_name, source_url, published_at"
    )
    .order("published_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (category) {
    q = q.eq("category", category);
  }

  const { data, error } = await q;
  const news = (data ?? []) as NewsRowData[];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <nav className="mb-4 text-xs">
        <Link
          href="/me"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← マイページ
        </Link>
      </nav>

      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ニュース管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            タイトル / 要約 / 画像 / カテゴリを手動編集できます。
          </p>
        </div>
        <Link
          href="/news"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          公開ページを見る →
        </Link>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
          取得エラー: {error.message}
        </div>
      )}

      {news.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          ニュースがありません。
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {news.length} 件{news.length >= PAGE_SIZE && " (上限)"}
          </p>
          <ul className="flex flex-col gap-3">
            {news.map((n) => (
              <NewsRow key={n.id} news={n} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
