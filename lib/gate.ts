// 開発中の目隠しゲート用の共有ロジック (proxy と /api/gate で共用)。
// パスワードそのものは Cookie に置かず、SHA-256 のトークンを保存して照合する。

export const GATE_COOKIE = "cue_gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 30; // 30日

export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode("cue-gate:" + password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// オープンリダイレクト防止: 自サイト内のパスのみ許可
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
