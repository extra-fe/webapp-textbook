import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { RouterView } from "vue-router";
import { router } from "../router";
import { ROUTES } from "../routes";
import { makeAuth, mountWithApp } from "./helpers";

/** router を挿して RouterView だけを描く器 */
const Shell = defineComponent({ setup: () => () => h(RouterView) });

const mountAt = async (
  path: string,
  auth = makeAuth({ isAuthenticated: false }),
) => {
  await router.push(path);
  await router.isReady();
  const mounted = mountWithApp(Shell, {
    auth,
    options: { global: { plugins: [router] } },
  });
  await flushPromises();
  return mounted;
};

beforeEach(async () => {
  await router.push(ROUTES.HOME.path);
});

describe("router", () => {
  it("未認証で /races を開くと一覧を描かない", async () => {
    const login = vi.fn();
    const auth = makeAuth({ isAuthenticated: false, login });

    const { wrapper } = await mountAt(ROUTES.RACES.path, auth);

    // ProtectedRoute は state==='login' のとき何も描かず login() を呼ぶ
    expect(login).toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("レース");
    expect(wrapper.find("ul").exists()).toBe(false);
  });

  // 一覧が描かれないのが「未認証だから」であることを、対照で押さえる
  it("認証済みなら /races で一覧の器が描かれる", async () => {
    const auth = makeAuth({
      isAuthenticated: true,
      user: { name: "Test", roles: ["viewer"] },
    });

    const { wrapper } = await mountAt(ROUTES.RACES.path, auth);

    expect(wrapper.text()).not.toContain("403 Forbidden");
  });

  it("未定義のパスは /error に寄る", async () => {
    await router.push("/no-such-page");
    await router.isReady();

    expect(router.currentRoute.value.path).toBe(ROUTES.ERROR.path);
  });

  it("/ と /login と /error は認証なしで開ける", async () => {
    for (const path of [ROUTES.HOME.path, ROUTES.ERROR.path]) {
      await router.push(path);
      expect(router.currentRoute.value.path).toBe(path);
    }
  });
});
