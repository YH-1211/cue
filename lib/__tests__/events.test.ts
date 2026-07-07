import { describe, it, expect } from "vitest";
import {
  isEventCategory,
  isParentCategory,
  parentOf,
  categoriesUnderParent,
  categoryLabel,
  inferCategory,
  SUBCATEGORIES,
} from "@/lib/events";

describe("isEventCategory", () => {
  it("親カテゴリもサブカテゴリも true", () => {
    expect(isEventCategory("festival")).toBe(true);
    expect(isEventCategory("festival_hanabi")).toBe(true);
  });

  it("未知の値は false", () => {
    expect(isEventCategory("unknown")).toBe(false);
    expect(isEventCategory("")).toBe(false);
  });
});

describe("isParentCategory", () => {
  it("親だけ true、サブは false", () => {
    expect(isParentCategory("music")).toBe(true);
    expect(isParentCategory("music_jazz")).toBe(false);
  });
});

describe("parentOf", () => {
  it("親はそのまま返す", () => {
    expect(parentOf("art")).toBe("art");
  });

  it("サブは対応する親に丸める", () => {
    expect(parentOf("music_jazz")).toBe("music");
    expect(parentOf("festival_hanabi")).toBe("festival");
    expect(parentOf("seasonal_sakura")).toBe("seasonal");
  });
});

describe("categoriesUnderParent", () => {
  it("親値自身 + 配下サブ全部を含む", () => {
    const result = categoriesUnderParent("food");
    expect(result).toContain("food");
    for (const sub of SUBCATEGORIES.food) {
      expect(result).toContain(sub);
    }
    expect(result).toHaveLength(1 + SUBCATEGORIES.food.length);
  });
});

describe("categoryLabel", () => {
  it("既知カテゴリは日本語ラベル", () => {
    expect(categoryLabel("festival")).toBe("祭り");
    expect(categoryLabel("music_jazz")).toBe("ジャズ");
  });

  it("未知の値はそのまま返す (落ちない)", () => {
    expect(categoryLabel("mystery")).toBe("mystery");
  });
});

describe("inferCategory", () => {
  it("キーワードからカテゴリを推定する", () => {
    expect(inferCategory("隅田川花火大会")).toBe("festival_hanabi");
    expect(inferCategory("お花見ナイト")).toBe("seasonal_sakura");
    expect(inferCategory("クラフトビールフェス")).toBe("food_drink");
  });

  it("先に評価される種別が優先される (花火 > 夏祭り)", () => {
    // "夏祭り" と "花火" 両方を含むが花火が先に定義されている
    expect(inferCategory("夏祭り花火大会")).toBe("festival_hanabi");
  });

  it("該当なし・空文字は null", () => {
    expect(inferCategory("特に何もない普通の集まり")).toBeNull();
    expect(inferCategory("")).toBeNull();
  });
});
