import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // CI で test.only を書き残したまま push するのを防ぐ
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    // formatDate（6.6節）はロケールを undefined にしてブラウザ設定に従わせる。
    // 既定の Chromium は en-US なので 05/25/2025 になり、日付のアサートが
    // 実行環境で変わってしまう。ロケールを固定して表記を決める。
    locale: "ja-JP",
    // TZ はあえて日本以外に置く。formatDate が timeZone: "UTC" を外すと
    // ここで1日ずれて落ちるので、6.6節の約束が実ブラウザで守られる。
    timezoneId: "America/New_York",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: {
      // 認証をスキップして mockAuth に差し替える。Keycloak のアダプターは
      // install すらされないので、IdP 用のダミー値を並べる必要はない。
      VITE_AUTH_ENABLED: "false",
      // API は page.route() でモックするのでバックエンドは起動しない。
      VITE_API_BASE_URL: "http://localhost:3000",
      // ローカルの .env で true にしたままでも E2E が落ちないように固定する。
      VITE_MAINTENANCE_MODE: "false",
    },
  },
});
