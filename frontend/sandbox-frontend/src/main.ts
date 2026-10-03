import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { keycloakAuth } from "./auth/keycloak/keycloak-adapter";

createApp(App).use(keycloakAuth).mount("#app");
