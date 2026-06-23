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

// 現在時刻 (UTC で動くサーバー基準の Date) を JST の暦日・時刻パーツに分解する。
// 時間帯による分岐 (cron の発火条件など) は必ずこの JST 時で判定すること。
// 素の getHours()/getDay() は UTC のままなので 9 時間ズレる。
export function jstParts(now: Date): {
  year: number;
  month: number; // 0 始まり (Date と同じ)
  day: number;
  hour: number;
  dow: number; // 0=日, 1=月, ... 6=土
} {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth(),
    day: jst.getUTCDate(),
    hour: jst.getUTCHours(),
    dow: jst.getUTCDay(),
  };
}

// JST の暦日時刻 (月は 0 始まり) を UTC の Date に変換する。
// 例: jstDateToUtc(2026, 5, 11, 0) = 2026-06-11 00:00 JST = 2026-06-10T15:00:00Z。
// day/month/hour は範囲外の値 (例: day+1, month+1) を渡すと自動繰り上がりする。
export function jstDateToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0
): Date {
  return new Date(Date.UTC(year, month, day, hour - 9, 0, 0, 0));
}

// 「今日の 0:00 (JST)」を UTC の ISO 文字列で返す。
// イベントの掲載カットオフに使う: effective_end >= この値 を残すと、
// 開催当日いっぱいは表示され、翌日 0:00 JST に一覧から消える。
export function startOfTodayJstIso(now: Date = new Date()): string {
  const { year, month, day } = jstParts(now);
  return jstDateToUtc(year, month, day, 0).toISOString();
}

// イベントが「掲載期限切れ (開催日翌日 0:00 JST 以降)」かどうかを判定する。
// effective = coalesce(ends_at, starts_at)。日程未定 (null) は期限切れ扱いしない。
export function isEventExpired(
  effectiveEnd: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!effectiveEnd) return false;
  return new Date(effectiveEnd).getTime() < new Date(startOfTodayJstIso(now)).getTime();
}
