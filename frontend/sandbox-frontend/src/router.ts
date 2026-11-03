import { createRouter, createWebHistory } from "vue-router";
import { ROUTES } from "./routes";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: ROUTES.HOME.path, component: () => import("./pages/HomePage.vue") },
    {
      path: ROUTES.LOGIN.path,
      component: () => import("./pages/LoginPage.vue"),
    },
    {
      path: ROUTES.RACES.path,
      component: () => import("./pages/RacesPage.vue"),
    },
    {
      path: ROUTES.ERROR.path,
      component: () => import("./pages/ErrorPage.vue"),
    },
    // 未定義のパスもエラー画面に寄せる
    { path: "/:pathMatch(.*)*", redirect: ROUTES.ERROR.path },
  ],
});
