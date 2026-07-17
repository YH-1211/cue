// 画像URLの軽量化。
// Unsplash など「クエリでリサイズできる」画像ホストに対して、
// 表示に必要な幅・品質・WebP変換のパラメータを付与し、転送量を削減する。
// 対応外のホスト（自前 Storage 等）はそのまま返す。

// クエリ (w / q / auto=format) でオンザフライ変換できる画像ホスト
const RESIZABLE_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
]);

/**
 * 表示幅に合わせて画像URLを最適化する。
 * @param url  元の画像URL（null 可）
 * @param width  表示に必要な実ピクセル幅（Retina を考慮して 2 倍程度で渡すと綺麗）
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  width: number,
): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url; // 相対パス等はそのまま
  }
  if (!RESIZABLE_HOSTS.has(u.hostname)) return url;

  u.searchParams.set("w", String(width));
  u.searchParams.set("q", "75");
  u.searchParams.set("auto", "format"); // 対応ブラウザには WebP を返す
  u.searchParams.set("fit", "crop");
  return u.toString();
}
