// ルートレベルのローディング: 各セグメントが loading.tsx を持たない場合のフォールバック。
// ナビゲーション直後に即座に描画され、体感ラグを抑える。
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="h-40 w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
