export default function Loading() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="mb-6 h-8 w-40 animate-pulse rounded bg-muted" />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="h-40 w-full animate-pulse bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
