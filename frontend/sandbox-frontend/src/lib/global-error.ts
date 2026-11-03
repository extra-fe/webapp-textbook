import type { App } from "vue";
import type { Router } from "vue-router";
import { ROUTES } from "../routes";

/**
 * 取りこぼしたエラーをエラーページへ寄せる。
 *
 * Vue の onErrorCaptured は描画中とライフサイクル（onMounted・watch・
 * イベントハンドラ）の throw を捕まえるが、次の2つは捕まえない。
 *  - ルートの遅延読み込みの失敗 → router.onError
 *  - 未処理の Promise rejection → window の unhandledrejection
 * あわせて、どの ErrorBoundary にも捕まらなかったものを
 * app.config.errorHandler で拾う。
 */
export const installGlobalErrorHandling = (app: App, router: Router) => {
  const goToErrorPage = (err: unknown) => {
    console.error("[global] 捕捉されなかったエラー", err);
    // エラーページをヒストリーに積むと「戻る」で壊れた画面に戻ってしまう
    void router.replace(ROUTES.ERROR.path);
  };

  // (1) 遅延読み込みの失敗など、ルーターが投げたもの
  router.onError(goToErrorPage);

  // (2) どの ErrorBoundary にも捕まらなかったもの
  app.config.errorHandler = goToErrorPage;

  // (3) 未処理の Promise rejection（Vue は捕捉しない）
  window.addEventListener("unhandledrejection", (e) => {
    e.preventDefault();
    goToErrorPage(e.reason);
  });
};
