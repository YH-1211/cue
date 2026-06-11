// datetime-local の文字列 ("YYYY-MM-DDTHH:mm"、タイムゾーン無し) は JST 壁時計として
// 入力される。サーバー(UTC)で素の new Date() に渡すと UTC 解釈され 9 時間ズレるため、
// タイムゾーンが無い場合は +09:00 を補って JST として解釈し、ISO 文字列に変換する。
export function jstLocalToIso(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const hasTz = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(t);
  const d = new Date(hasTz ? t : `${t}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
