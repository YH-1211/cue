// 管理画面共通のローディング: 見出し + 行のスケルトン。
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12"
    >
      <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
