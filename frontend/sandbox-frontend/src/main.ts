import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { keycloakAuth } from "./auth/keycloak/keycloak-adapter";
import { toastPlugin } from "./components/toast-plugin";
import { i18n } from "./i18n";
import { router } from "./router";

createApp(App)
  .use(i18n)
  .use(toastPlugin)
  .use(keycloakAuth)
  .use(router)
  .mount("#app");
