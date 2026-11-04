import { afterEach, describe, expect, it, vi } from "vitest";
import MaintenancePage from "../pages/MaintenancePage.vue";
import { mountWithApp } from "./helpers";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MaintenancePage", () => {
  it("見出しと本文が出る", () => {
    const { wrapper } = mountWithApp(MaintenancePage);

    expect(wrapper.find("h1").text()).toBe("メンテナンス中");
    expect(wrapper.text()).toContain(
      "現在システムのメンテナンスを行っています。",
    );
  });

  it("復旧予定が未設定なら「未定」と出る", () => {
    vi.stubEnv("VITE_MAINTENANCE_SCHEDULED_END", "");
    const { wrapper } = mountWithApp(MaintenancePage);

    expect(wrapper.text()).toContain("復旧予定時刻");
    expect(wrapper.text()).toContain("未定");
  });

  it("復旧予定が設定されていればその値が出る", () => {
    vi.stubEnv("VITE_MAINTENANCE_SCHEDULED_END", "2026-09-06 12:00 JST");
    const { wrapper } = mountWithApp(MaintenancePage);

    expect(wrapper.text()).toContain("2026-09-06 12:00 JST");
    expect(wrapper.text()).not.toContain("未定");
  });

  // ロケールファイルに置くと vue-i18n が "@" を linked message と解釈して
  // メッセージのコンパイルに失敗し、この画面が真っ白になる（本文3.11節）
  it("問い合わせ先のメールアドレスが出る", () => {
    vi.stubEnv("VITE_SUPPORT_EMAIL", "ops@example.com");
    const { wrapper } = mountWithApp(MaintenancePage);

    expect(wrapper.text()).toContain("お問い合わせ");
    expect(wrapper.text()).toContain("ops@example.com");
  });

  it("VITE_SUPPORT_EMAIL が無ければ既定のアドレスが出る", () => {
    const { wrapper } = mountWithApp(MaintenancePage);

    expect(wrapper.text()).toContain("support@example.com");
  });
});
