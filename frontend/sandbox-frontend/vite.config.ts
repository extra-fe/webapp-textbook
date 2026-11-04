/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      // src/ を指す @ も張っておく。以降 "@/components/..." のように書ける
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      zod: fileURLToPath(new URL("./node_modules/zod", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom", // コンポーネントを描画するので DOM が要る
    setupFiles: "./src/test/setup.ts",
    // e2e/ は Playwright が実行する。Vitest が拾うと二重実行になる。
    exclude: ["node_modules", "dist", "e2e/**"],
    // msw のハンドラーは実装と同じ `${VITE_API_BASE_URL}${path}` で URL を
    // 組み立てる。.env は .gitignore 対象で CI に無いので、ここで固定する。
    env: { VITE_API_BASE_URL: "http://localhost:3000" },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,vue}"],
      exclude: ["src/main.ts", "src/test/**", "src/mocks/**", "**/*.d.ts"],
      // 実測の少し下に置き、テストを足したら引き上げる（ratchet 運用）
      thresholds: { statements: 69, branches: 56, functions: 60, lines: 72 },
    },
  },
});
