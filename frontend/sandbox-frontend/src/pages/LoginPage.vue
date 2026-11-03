<script setup lang="ts">
import { useAuth } from "../auth/auth-context";
import AnnouncementList from "../components/AnnouncementList.vue";

const { isLoading, login } = useAuth();
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-slate-900">競馬レース管理</h1>

    <!-- isLoading に関わらず常にマウントしてフェッチを開始する -->
    <AnnouncementList class="mt-4" />

    <p v-if="isLoading" class="mt-4 text-sm text-slate-600">読み込み中...</p>
    <button
      v-else
      type="button"
      class="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      @click="login"
    >
      ログイン
    </button>
  </div>
</template>
