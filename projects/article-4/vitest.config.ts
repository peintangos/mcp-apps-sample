import { defineConfig } from "vitest/config";

// Vite config (vite.config.ts) は UI singlefile 用に root を src/ に切っている。
// Vitest はそれを使わず project root から src 以下の .test.ts を直接実行する。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
