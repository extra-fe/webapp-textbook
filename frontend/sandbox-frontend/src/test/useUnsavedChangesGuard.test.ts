import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { useUnsavedChangesGuard } from "../composables/useUnsavedChangesGuard";

/**
 * cancelable な beforeunload を投げて defaultPrevented を読む。
 * リスナーが登録されていれば preventDefault されるので、
 * ネイティブダイアログを出さずに登録状態を判定できる。
 */
const beforeUnloadIsGuarded = (): boolean => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

const isDirty = ref(false);
const confirmLeave = vi.fn(() => Promise.resolve(true));

const Host = defineComponent({
  setup() {
    useUnsavedChangesGuard(isDirty, confirmLeave);
    return () => h("div", "host");
  },
});
const Other = defineComponent({ setup: () => () => h("div", "other") });

const mountInRouter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: Host },
      { path: "/other", component: Other },
    ],
  });
  await router.push("/");
  await router.isReady();
  const wrapper = mount(defineComponent({ setup: () => () => h(RouterView) }), {
    global: { plugins: [router] },
  });
  await flushPromises();
  return { wrapper, router };
};

beforeEach(() => {
  isDirty.value = false;
  confirmLeave.mockClear();
});

describe("useUnsavedChangesGuard", () => {
  it("未入力のあいだは引き止めない", async () => {
    await mountInRouter();
    expect(beforeUnloadIsGuarded()).toBe(false);
  });

  it("入力されると引き止め、消えるとやめる", async () => {
    await mountInRouter();

    isDirty.value = true;
    await flushPromises();
    expect(beforeUnloadIsGuarded()).toBe(true);

    // 送信に成功して resetForm() が走った状態
    isDirty.value = false;
    await flushPromises();
    expect(beforeUnloadIsGuarded()).toBe(false);
  });

  // 解除を onUnmounted に書き忘れると、画面を離れたあとも window に残る
  it("入力があるままアンマウントされても window に残らない", async () => {
    const { wrapper } = await mountInRouter();

    isDirty.value = true;
    await flushPromises();
    expect(beforeUnloadIsGuarded()).toBe(true);

    wrapper.unmount();
    expect(beforeUnloadIsGuarded()).toBe(false);
  });

  it("未入力ならアプリ内遷移は確認なしで通る", async () => {
    const { router } = await mountInRouter();

    await router.push("/other");
    await flushPromises();

    expect(confirmLeave).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe("/other");
  });

  it("入力があるとアプリ内遷移で確認を出し、false なら留まる", async () => {
    const { router } = await mountInRouter();
    isDirty.value = true;
    await flushPromises();

    confirmLeave.mockResolvedValueOnce(false);
    await router.push("/other");
    await flushPromises();

    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.path).toBe("/");
  });

  it("確認で true を返せば遷移できる", async () => {
    const { router } = await mountInRouter();
    isDirty.value = true;
    await flushPromises();

    await router.push("/other");
    await flushPromises();

    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.path).toBe("/other");
  });
});
