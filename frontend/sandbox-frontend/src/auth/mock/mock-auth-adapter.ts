import { type App, ref } from "vue";
import { authKey, type IAuthContext } from "../auth-context";

/**
 * VITE_AUTH_ENABLED=false のときに使うモック認証アダプター（Vue プラグイン）。
 *
 * バックエンドの MockAuthGuard（1.6節）のフロントエンド版で、Keycloak を
 * 起動せずに保護された画面を開けるようにする。E2E（Playwright）がこれを使う。
 */
export const mockAuth = {
  install(app: App) {
    const auth: IAuthContext = {
      isAuthenticated: ref(true),
      isLoading: ref(false),
      user: ref({ name: "Mock User", roles: ["admin"] }),
      login: () => {},
      logout: () => {},
      // 認証無効時は useApiCaller が Authorization ヘッダを付けないので使われない。
      getToken: () => Promise.resolve(""),
    };

    app.provide(authKey, auth);
  },
};
