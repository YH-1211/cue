import { describe, it, expect } from "vitest";
import {
  jstLocalToIso,
  jstParts,
  jstDateToUtc,
  startOfTodayJstIso,
  isEventExpired,
} from "@/lib/datetime";

describe("jstLocalToIso", () => {
  it("TZ なしの壁時計は JST として解釈する (UTC に -9h)", () => {
    // 2026-06-11 00:00 JST = 2026-06-10T15:00:00Z
    expect(jstLocalToIso("2026-06-11T00:00")).toBe("2026-06-10T15:00:00.000Z");
  });

  it("既に TZ 付きならそのまま尊重する", () => {
    expect(jstLocalToIso("2026-06-11T00:00:00+09:00")).toBe(
      "2026-06-10T15:00:00.000Z"
    );
    expect(jstLocalToIso("2026-06-10T15:00:00Z")).toBe(
      "2026-06-10T15:00:00.000Z"
    );
  });

  it("空文字・不正な入力は null", () => {
    expect(jstLocalToIso("")).toBeNull();
    expect(jstLocalToIso("   ")).toBeNull();
    expect(jstLocalToIso("not-a-date")).toBeNull();
  });
});

describe("jstParts", () => {
  it("UTC の Date を JST の暦パーツに分解する", () => {
    // 2026-06-10T15:00:00Z = 2026-06-11 00:00 JST
    const p = jstParts(new Date("2026-06-10T15:00:00Z"));
    expect(p).toEqual({ year: 2026, month: 5, day: 11, hour: 0, dow: 4 });
  });

  it("UTC 深夜は JST では翌日午前になる", () => {
    // 2026-01-01T20:00:00Z = 2026-01-02 05:00 JST
    const p = jstParts(new Date("2026-01-01T20:00:00Z"));
    expect(p.day).toBe(2);
    expect(p.hour).toBe(5);
  });
});

describe("jstDateToUtc", () => {
  it("JST 暦日時刻を UTC の Date に変換する", () => {
    expect(jstDateToUtc(2026, 5, 11, 0).toISOString()).toBe(
      "2026-06-10T15:00:00.000Z"
    );
  });

  it("hour の繰り下がりで前日にまたがる", () => {
    // JST 2026-06-11 00:00 → UTC 前日 15:00
    expect(jstDateToUtc(2026, 5, 11, 0).getUTCDate()).toBe(10);
  });
});

describe("startOfTodayJstIso", () => {
  it("その JST 日の 0:00 を UTC ISO で返す", () => {
    // now = 2026-06-11 09:30 JST 相当
    const now = new Date("2026-06-11T00:30:00Z"); // = JST 09:30
    expect(startOfTodayJstIso(now)).toBe("2026-06-10T15:00:00.000Z");
  });
});

describe("isEventExpired", () => {
  const now = new Date("2026-06-11T03:00:00Z"); // JST 12:00 の 6/11

  it("日程未定 (null) は期限切れにしない", () => {
    expect(isEventExpired(null, now)).toBe(false);
    expect(isEventExpired(undefined, now)).toBe(false);
  });

  it("前日終了のイベントは期限切れ", () => {
    // 6/10 の開催 (JST) → 翌日 0:00 を過ぎている
    expect(isEventExpired("2026-06-10T09:00:00Z", now)).toBe(true);
  });

  it("当日開催はまだ表示される (期限切れでない)", () => {
    // 6/11 開催 (JST 昼)
    expect(isEventExpired("2026-06-11T06:00:00Z", now)).toBe(false);
  });
});
