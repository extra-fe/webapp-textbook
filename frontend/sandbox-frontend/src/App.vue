<script setup lang="ts">
import { useAuth } from "./auth/auth-context";
import ToastHost from "./components/ToastHost.vue";
import LoginPage from "./pages/LoginPage.vue";
import RaceListPage from "./pages/RaceListPage.vue";

const { isAuthenticated, user, logout } = useAuth();
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50">
    <div class="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900">競馬レース管理</h1>

      <template v-if="isAuthenticated">
        <p class="mt-2 text-sm text-slate-600">ユーザー：{{ user?.name }}</p>
        <p class="mt-1 text-sm text-slate-600">
          ロール：{{ user?.roles?.join(", ") }}
        </p>
        <button
          type="button"
          class="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          @click="logout"
        >
          ログアウト
        </button>

        <RaceListPage />
      </template>

      <!-- 未認証（判定中を含む）はログイン画面。お知らせは判定を待たない -->
      <LoginPage v-else />
    </div>
  </div>

  <ToastHost />
</template>
