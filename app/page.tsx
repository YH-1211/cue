import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS: Record<string, string> = {
  art: "アート",
  music: "音楽",
  theater: "舞台",
  festival: "祭り",
  food: "フード",
  seasonal: "季節",
  film: "映像",
  learning: "学び",
};

type Tag = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
};

export default async function Home() {
  const supabase = await createClient();

  const { data: tags, error } = await supabase
    .from("tags")
    .select("id, slug, name, category")
    .order("category", { ascending: true })
    .order("id", { ascending: true });

  // カテゴリ別にグループ化
  const tagsByCategory = (tags ?? []).reduce<Record<string, Tag[]>>(
    (acc, tag) => {
      const key = tag.category ?? "other";
      (acc[key] ??= []).push(tag);
      return acc;
    },
    {}
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-12 px-6 py-16">
      <section className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">Cue</h1>
        <p className="text-lg text-muted-foreground">
          次の合図を、あなたへ。
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          東京のアート・音楽・舞台・祭り・季節の出来事を、見逃さないために。
        </p>
      </section>

      <section className="w-full">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          興味タグ (DB接続テスト)
        </h2>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            タグ取得エラー: {error.message}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(tagsByCategory).map(([category, items]) => (
              <div key={category}>
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((tag) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
