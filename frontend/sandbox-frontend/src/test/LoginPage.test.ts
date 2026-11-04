import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import LoginPage from "../pages/LoginPage.vue";
import { ROUTES } from "../routes";
import { makeAuth, mountWithApp } from "./helpers";

/**
 * 応答の中身は要らず「送られたか」だけを見るので、http-client を
 * モジュールごと差し替える。解決しない Promise を返しておけば、
 * アサートのあとに状態更新が走らず後片付けも要らない。
 */
const { mockAnnouncementGet } = vi.hoisted(() => ({
  mockAnnouncementGet: vi.fn().mockImplementation(() => new Promise(() => {})),
}));
vi.mock("../lib/http-client", () => ({
  apiClient: { get: mockAnnouncementGet },
  storageClient: { request: vi.fn() },
  isCancel: vi.fn().mockReturnValue(false),
}));

const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: ROUTES.LOGIN.path, component: LoginPage },
      { path: ROUTES.RACES.path, component: { template: "<div>races</div>" } },
    ],
  });

const mountLogin = async (
  authOverrides: Parameters<typeof makeAuth>[0] = {},
) => {
  const router = makeRouter();
  await router.push(ROUTES.LOGIN.path);
  await router.isReady();
  const mounted = mountWithApp(LoginPage, {
    auth: makeAuth(authOverrides),
    options: { global: { plugins: [router] } },
  });
  await flushPromises();
  return { ...mounted, router };
};

beforeEach(() => {
  mockAnnouncementGet.mockClear();
});

describe("LoginPage", () => {
  it("認証の判定を待たずにお知らせの取得を始める（直列にしない）", async () => {
    await mountLogin({ isLoading: true });

    await vi.waitFor(() => {
      expect(mockAnnouncementGet).toHaveBeenCalledWith(
        expect.stringContaining("/api/guest/announcements"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("判定中はログインボタンを出さず「読み込み中...」を見せる", async () => {
    const { wrapper } = await mountLogin({ isLoading: true });

    expect(wrapper.text()).toContain("読み込み中...");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("未認証ならログインボタンを出す", async () => {
    const login = vi.fn();
    const { wrapper } = await mountLogin({
      isLoading: false,
      isAuthenticated: false,
      login,
    });

    const button = wrapper.find("button");
    expect(button.text()).toBe("ログイン");

    await button.trigger("click");
    expect(login).toHaveBeenCalled();
  });

  // push だと「戻る」で /login に着いてまた飛ばされ、抜け出せなくなる（3.9節）
  it("認証済みなら /races へ replace する", async () => {
    const { router } = await mountLogin({ isAuthenticated: true });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe(ROUTES.RACES.path);
  });
});
