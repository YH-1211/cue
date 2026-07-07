import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// lib/ の純粋関数を対象にしたユニットテスト設定。
// tsconfig の "@/*" エイリアスを解決できるようにする。
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
