import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "vue";
import type { Router } from "vue-router";
import { installGlobalErrorHandling } from "../lib/global-error";
import { ROUTES } from "../routes";

/**
 * 3経路（router.onError / app.config.errorHandler / unhandledrejection）
 * から、どれも replace でエラーページへ寄ることを見る。
 */
const build = () => {
  const replace = vi.fn();
  const push = vi.fn();
  let routerErrorHandler: ((err: unknown) => void) | undefined;

  const router = {
    onError: (fn: (err: unknown) => void) => {
      routerErrorHandler = fn;
    },
    replace,
    push,
  } as unknown as Router;

  const app = { config: {} } as App;

  installGlobalErrorHandling(app, router);
  return {
    app,
    replace,
    push,
    fireRouterError: (e: unknown) => routerErrorHandler?.(e),
  };
};

describe("installGlobalErrorHandling", () => {
  beforeEach(() => {
    // goToErrorPage が console.error を呼ぶので、出力だけ止める
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("router.onError で /error へ replace する", () => {
    const { replace, fireRouterError } = build();

    fireRouterError(new Error("chunk load failed"));

    expect(replace).toHaveBeenCalledWith(ROUTES.ERROR.path);
  });

  it("app.config.errorHandler で /error へ replace する", () => {
    const { app, replace } = build();

    app.config.errorHandler?.(new Error("uncaught"), null, "");

    expect(replace).toHaveBeenCalledWith(ROUTES.ERROR.path);
  });

  it("unhandledrejection で /error へ replace し、既定の動作を止める", () => {
    const { replace } = build();

    const event = new Event("unhandledrejection", {
      cancelable: true,
    }) as Event & { reason?: unknown };
    event.reason = new Error("rejected");
    window.dispatchEvent(event);

    expect(replace).toHaveBeenCalledWith(ROUTES.ERROR.path);
    // preventDefault を外すと Node/ブラウザ既定の未処理拒否として扱われる
    expect(event.defaultPrevented).toBe(true);
  });

  // push だと「戻る」で壊れた画面に戻れてしまう
  it("push ではなく replace を使う", () => {
    const { replace, push, fireRouterError } = build();

    fireRouterError(new Error("x"));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
});
