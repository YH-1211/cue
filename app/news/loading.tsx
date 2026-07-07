// ニュース一覧のローディング: 見出し + 記事行のスケルトン。
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="size-20 shrink-0 animate-pulse rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
