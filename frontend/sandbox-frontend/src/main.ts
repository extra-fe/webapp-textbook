import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { keycloakAuth } from "./auth/keycloak/keycloak-adapter";
import { toastPlugin } from "./components/toast-plugin";
import { i18n } from "./i18n";
import { isMaintenanceBypassed, isMaintenanceMode } from "./lib/maintenance";
import MaintenancePage from "./pages/MaintenancePage.vue";
import { router } from "./router";

if (isMaintenanceMode() && !isMaintenanceBypassed()) {
  // 認証もルーターもトーストも立ち上げない。文言を出すための i18n だけ足す
  createApp(MaintenancePage).use(i18n).mount("#app");
} else {
  createApp(App)
    .use(i18n)
    .use(toastPlugin)
    .use(keycloakAuth)
    .use(router)
    .mount("#app");
}
