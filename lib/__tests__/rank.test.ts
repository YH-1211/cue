import { describe, it, expect } from "vitest";
import { rankFor, nextRank, RANKS } from "@/lib/rank";

describe("rankFor", () => {
  it("0pt はビギナー", () => {
    expect(rankFor(0).label).toBe("ビギナー");
  });

  it("各しきい値ちょうどで昇格する", () => {
    expect(rankFor(10).label).toBe("探検家");
    expect(rankFor(50).label).toBe("常連");
    expect(rankFor(150).label).toBe("達人");
    expect(rankFor(400).label).toBe("レジェンド");
  });

  it("しきい値の 1 手前は昇格しない", () => {
    expect(rankFor(9).label).toBe("ビギナー");
    expect(rankFor(49).label).toBe("探検家");
    expect(rankFor(399).label).toBe("達人");
  });

  it("上限を超えても最上位ランクのまま", () => {
    expect(rankFor(999999).label).toBe("レジェンド");
  });

  it("負のポイントでもビギナーにフォールバックする", () => {
    expect(rankFor(-100).label).toBe("ビギナー");
  });
});

describe("nextRank", () => {
  it("ビギナーの次は探検家 (残り 10)", () => {
    const n = nextRank(0);
    expect(n?.rank.label).toBe("探検家");
    expect(n?.remaining).toBe(10);
  });

  it("残りポイントは正しく計算される", () => {
    expect(nextRank(45)?.remaining).toBe(5); // 常連まで残り5
    expect(nextRank(45)?.rank.label).toBe("常連");
  });

  it("最上位ランクでは null", () => {
    expect(nextRank(400)).toBeNull();
    expect(nextRank(500)).toBeNull();
  });
});

describe("RANKS 定義", () => {
  it("minPoints 降順で並んでいる (rankFor が find で正しく動く前提)", () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i - 1].minPoints).toBeGreaterThan(RANKS[i].minPoints);
    }
  });
});
