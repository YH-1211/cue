import { sanitizeNext } from "@/lib/gate";

export const metadata = { title: "ロック中" };

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = sanitizeNext(sp.next);
  const error = sp.error === "1";

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-6">
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Cue</h1>
          <p className="text-sm text-muted-foreground">
            現在このサイトは開発中です。
            <br />
            合言葉を入力してください。
          </p>
        </div>

        <form method="POST" action="/api/gate" className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <input
            type="password"
            name="password"
            autoFocus
            autoComplete="current-password"
            placeholder="パスワード"
            className="h-11 rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-foreground"
          />
          {error && (
            <p className="text-sm text-red-500">パスワードが違います。</p>
          )}
          <button
            type="submit"
            className="h-11 rounded-lg bg-foreground text-base font-medium text-background transition-opacity hover:opacity-90"
          >
            入る
          </button>
        </form>
      </div>
    </div>
  );
}
