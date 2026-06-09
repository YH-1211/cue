import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { HandledButton } from "./handled-button";

export const metadata = { title: "管理 / お問い合わせ" };
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  bug: "不具合",
  request: "要望",
  event: "イベント",
  account: "アカウント",
  other: "その他",
};

type ContactRow = {
  id: string;
  name: string;
  email: string;
  category: string;
  body: string;
  handled: boolean;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

export default async function AdminContactPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/me");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contact_messages")
    .select("id, name, email, category, body, handled, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const messages = (data ?? []) as ContactRow[];
  const unhandled = messages.filter((m) => !m.handled).length;

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

      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">お問い合わせ</h1>
        <p className="text-sm text-muted-foreground">
          全 {messages.length} 件 / 未対応 {unhandled} 件
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          取得エラー: {error.message}
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          お問い合わせはまだありません。
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {CATEGORY_LABELS[m.category] ?? m.category}
                </Badge>
                {m.handled ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    対応済み
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                    未対応
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {dateFormatter.format(new Date(m.created_at))}
                </span>
              </div>

              <div className="text-sm">
                <span className="font-semibold">{m.name}</span>{" "}
                <a
                  href={`mailto:${m.email}`}
                  className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  &lt;{m.email}&gt;
                </a>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {m.body}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent(
                    "Re: お問い合わせ"
                  )}`}
                  className="text-xs text-foreground underline underline-offset-2"
                >
                  メールで返信
                </a>
                <span className="ml-auto">
                  <HandledButton id={m.id} handled={m.handled} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
