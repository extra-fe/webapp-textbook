import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, nextTick, onMounted, ref, watch } from "vue";
import ErrorBoundary from "../components/ErrorBoundary.vue";
import { mountWithApp } from "./helpers";

const NormalChild = { setup: () => () => h("div", "Normal Content") };

const ThrowingChild = {
  setup() {
    throw new Error("Test error message");
  },
};

/** onMounted の中で throw する子。React の ErrorBoundary はこれを捕まえられなかった。 */
const ThrowOnMounted = {
  setup() {
    onMounted(() => {
      throw new Error("mounted error");
    });
    return () => h("div", "Normal Content");
  },
};

/** イベントハンドラの中で throw する子。 */
const ThrowInHandler = {
  setup() {
    return () =>
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            throw new Error("handler error");
          },
        },
        "click me",
      );
  },
};

/** watch のコールバックの中で throw する子。 */
const makeThrowInWatch = (trigger: { value: number }) => ({
  setup() {
    watch(trigger, () => {
      throw new Error("watch error");
    });
    return () => h("div", "Normal Content");
  },
});

/** shouldThrow を外から切り替えられる子。再試行の検証に使う。 */
const makeDynamicChild = (shouldThrow: { value: boolean }) => ({
  setup() {
    return () => {
      if (shouldThrow.value) throw new Error("Test error message");
      return h("div", "Normal Content");
    };
  },
});

const mountBoundary = (
  child: unknown,
  extraSlots: Record<string, unknown> = {},
) =>
  mountWithApp(ErrorBoundary, {
    options: {
      slots: { default: () => h(child as never), ...extraSlots },
    },
  }).wrapper;

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Vue が捕捉したエラーをコンソールに出すのを抑制
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("エラーが無ければ children を描画する", () => {
    expect(mountBoundary(NormalChild).text()).toContain("Normal Content");
  });

  it("子が throw したら既定のエラー UI を出す", async () => {
    const w = mountBoundary(ThrowingChild);
    await nextTick();

    expect(w.find('[role="alert"]').exists()).toBe(true);
    expect(w.text()).toContain("エラーが発生しました");
    expect(w.findAll("button").some((b) => b.text() === "再試行")).toBe(true);
  });

  // React の ErrorBoundary は描画中の throw しか捕まえられず、useEffect や
  // イベントハンドラの中で投げられたものは素通りしていた。Vue の
  // onErrorCaptured はそれらも捕まえる。ここはその差を固定するためのテスト。
  it("onMounted 内の throw も捕まえる", async () => {
    const w = mountBoundary(ThrowOnMounted);
    await nextTick();
    expect(w.find('[role="alert"]').exists()).toBe(true);
  });

  it("イベントハンドラ内の throw も捕まえる", async () => {
    const w = mountBoundary(ThrowInHandler);
    await w.find("button").trigger("click");
    await nextTick();
    expect(w.find('[role="alert"]').exists()).toBe(true);
  });

  it("watch 内の throw も捕まえる", async () => {
    const trigger = ref(0);
    const w = mountBoundary(makeThrowInWatch(trigger));
    expect(w.find('[role="alert"]').exists()).toBe(false);

    trigger.value = 1;
    await nextTick();
    await nextTick();
    expect(w.find('[role="alert"]').exists()).toBe(true);
  });

  it("fallback スロットがあればそちらを出す", async () => {
    const w = mountBoundary(ThrowingChild, {
      fallback: () => h("div", "Custom Fallback"),
    });
    await nextTick();

    expect(w.text()).toContain("Custom Fallback");
    expect(w.text()).not.toContain("エラーが発生しました");
  });

  it("再試行ボタンでエラー状態がリセットされる", async () => {
    const shouldThrow = ref(true);
    const w = mountBoundary(makeDynamicChild(shouldThrow));
    await nextTick();
    expect(w.text()).toContain("エラーが発生しました");

    // クリック前にフラグを下げて、リセット後の再描画で throw しないようにする
    shouldThrow.value = false;
    const retry = w.findAll("button").find((b) => b.text() === "再試行");
    await retry?.trigger("click");
    await nextTick();

    expect(w.text()).toContain("Normal Content");
    expect(w.text()).not.toContain("エラーが発生しました");
  });
});
