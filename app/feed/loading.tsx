export default function Loading() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10"
    >
      <div className="mb-6 space-y-2">
        <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      </div>
      <ul className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 animate-pulse rounded-full bg-muted" />
              <div className="flex flex-1 flex-col gap-1">
                <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
            <div className="mt-3 h-16 animate-pulse rounded-md bg-muted" />
            <div className="mt-3 aspect-square w-full animate-pulse rounded-md bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}
