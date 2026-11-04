import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMaintenanceBypassed, isMaintenanceMode } from "../lib/maintenance";

const TOKEN = "s3cret-bypass";

/** document.cookie を空にする */
const clearCookies = () => {
  for (const row of document.cookie.split("; ")) {
    const name = row.split("=")[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
};

/** location.search と location.replace を差し替える */
const setLocation = (search: string) => {
  const replace = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      search,
      pathname: "/races",
      protocol: "http:",
      replace,
    },
  });
  return replace;
};

const ORIGINAL_LOCATION = window.location;

beforeEach(() => {
  clearCookies();
});

afterEach(() => {
  vi.unstubAllEnvs();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: ORIGINAL_LOCATION,
  });
});

describe("isMaintenanceMode", () => {
  it("VITE_MAINTENANCE_MODE が 'true' のときだけ true", () => {
    vi.stubEnv("VITE_MAINTENANCE_MODE", "true");
    expect(isMaintenanceMode()).toBe(true);

    vi.stubEnv("VITE_MAINTENANCE_MODE", "false");
    expect(isMaintenanceMode()).toBe(false);

    // "1" や "TRUE" では有効にならない。文字列の完全一致で判定している
    vi.stubEnv("VITE_MAINTENANCE_MODE", "1");
    expect(isMaintenanceMode()).toBe(false);
  });

  it("未設定なら false", () => {
    vi.stubEnv("VITE_MAINTENANCE_MODE", "");
    expect(isMaintenanceMode()).toBe(false);
  });
});

describe("isMaintenanceBypassed", () => {
  // ここが最重要。トークン未設定で素通りすると、メンテナンス中に全員が入れる
  it("トークンが未設定ならクッキーが何であっても false", () => {
    vi.stubEnv("VITE_MAINTENANCE_BYPASS_TOKEN", "");
    setLocation("");
    document.cookie = `maintenance_bypass=${TOKEN}; Path=/`;

    expect(isMaintenanceBypassed()).toBe(false);
  });

  it("クッキーがトークンと一致すれば true", () => {
    vi.stubEnv("VITE_MAINTENANCE_BYPASS_TOKEN", TOKEN);
    setLocation("");
    document.cookie = `maintenance_bypass=${TOKEN}; Path=/`;

    expect(isMaintenanceBypassed()).toBe(true);
  });

  it("クッキーが一致しなければ false", () => {
    vi.stubEnv("VITE_MAINTENANCE_BYPASS_TOKEN", TOKEN);
    setLocation("");
    document.cookie = "maintenance_bypass=wrong; Path=/";

    expect(isMaintenanceBypassed()).toBe(false);
  });

  it("クッキーが無ければ false", () => {
    vi.stubEnv("VITE_MAINTENANCE_BYPASS_TOKEN", TOKEN);
    setLocation("");

    expect(isMaintenanceBypassed()).toBe(false);
  });

  it("正しいクエリで来たらクッキーへ移し、URL からパラメータを落とす", () => {
    vi.stubEnv("VITE_MAINTENANCE_BYPASS_TOKEN", TOKEN);
    const replace = setLocation(`?maintenance_bypass=${TOKEN}&keep=1`);

    expect(isMaintenanceBypassed()).toBe(true);
    expect(document.cookie).toContain(`maintenance_bypass=${TOKEN}`);
    // 他のクエリは残したまま、bypass だけ落ちる
    expect(replace).toHaveBeenCalledWith("/races?keep=1");
  });

  it("クエリのトークンが違えばクッキーにも入れない", () => {
    vi.stubEnv("VITE_MAINTENANCE_BYPASS_TOKEN", TOKEN);
    const replace = setLocation("?maintenance_bypass=wrong");

    expect(isMaintenanceBypassed()).toBe(false);
    expect(document.cookie).not.toContain("maintenance_bypass=");
    expect(replace).not.toHaveBeenCalled();
  });
});
