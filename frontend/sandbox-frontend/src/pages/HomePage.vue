<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useAuth } from "../auth/auth-context";
import PageContainer from "../components/PageContainer.vue";
import { ROUTES } from "../routes";

const { isAuthenticated, isLoading, user, login, logout } = useAuth();
</script>

<template>
  <PageContainer>
    <h1 class="text-2xl font-bold text-slate-900">競馬レース管理</h1>

    <p v-if="isLoading" class="mt-2 text-sm text-slate-600">
      認証状態を確認しています…
    </p>

    <template v-else-if="isAuthenticated">
      <p class="mt-2 text-sm text-slate-600">ユーザー：{{ user?.name }}</p>
      <p class="mt-1 text-sm text-slate-600">
        ロール：{{ user?.roles?.join(", ") }}
      </p>
      <RouterLink
        :to="ROUTES.RACES.path"
        class="mt-4 inline-block underline underline-offset-2"
      >
        レース一覧へ
      </RouterLink>
      <button
        type="button"
        class="mt-4 ml-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        @click="logout"
      >
        ログアウト
      </button>
    </template>

    <button
      v-else
      type="button"
      class="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      @click="login"
    >
      ログイン
    </button>
  </PageContainer>
</template>
