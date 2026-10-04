import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, inject } from "vue";
import { authKey, type IAuthContext } from "../auth/auth-context";

/**
 * authAdapter は import.meta.env をモジュール評価時に1度だけ読む。
 * stubEnv を効かせるには、毎回モジュールキャッシュを捨てて読み直す。
 */
const loadAdapter = async () => {
  const { authAdapter } = await import("../auth/auth-adapter");
  return authAdapter;
};

/** authAdapter を use() して、provide された IAuthContext を取り出す */
const resolveAuth = async (): Promise<IAuthContext> => {
  const app = createApp({ render: () => null });
  app.use(await loadAdapter());
  const auth = app.runWithContext(() => inject(authKey));
  if (!auth) throw new Error("authKey が provide されていない");
  return auth;
};

describe("authAdapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    // これを忘れると2回目の import がキャッシュを返し、stubEnv が効かない
    vi.resetModules();
  });

  it("VITE_AUTH_ENABLED=false ならモックが入り、Keycloak には触らない", async () => {
    vi.stubEnv("VITE_AUTH_ENABLED", "false");
    const auth = await resolveAuth();

    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.isLoading.value).toBe(false);
    expect(auth.user.value).toEqual({ name: "Mock User", roles: ["admin"] });
    expect(await auth.getToken()).toBe("");
  });

  it("VITE_AUTH_ENABLED=true なら Keycloak アダプターが選ばれること", async () => {
    vi.stubEnv("VITE_AUTH_ENABLED", "true");
    const adapter = await loadAdapter();
    const { keycloakAuth } = await import("../auth/keycloak/keycloak-adapter");

    // install はしない。init() が走って Keycloak を叩きにいってしまう
    expect(adapter).toBe(keycloakAuth);
  });
});
