// 季節カレンダーのローディング: 見出し + 月ブロックのスケルトン。
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={j}
                  className="h-24 animate-pulse rounded-lg border border-border bg-card"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
