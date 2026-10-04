import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { authAdapter } from "./auth/auth-adapter";
import { toastPlugin } from "./components/toast-plugin";
import { i18n } from "./i18n";
import { installGlobalErrorHandling } from "./lib/global-error";
import { isMaintenanceBypassed, isMaintenanceMode } from "./lib/maintenance";
import MaintenancePage from "./pages/MaintenancePage.vue";
import { router } from "./router";

if (isMaintenanceMode() && !isMaintenanceBypassed()) {
  // 認証もルーターもトーストも立ち上げない。文言を出すための i18n だけ足す
  createApp(MaintenancePage).use(i18n).mount("#app");
} else {
  const app = createApp(App)
    .use(i18n)
    .use(toastPlugin)
    .use(authAdapter)
    .use(router);
  // 開発時だけ、ブラウザの Performance パネルに計測点を出す（7.6節）
  app.config.performance = import.meta.env.DEV;
  installGlobalErrorHandling(app, router);
  app.mount("#app");
}
