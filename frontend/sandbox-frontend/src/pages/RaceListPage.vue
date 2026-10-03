<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { Race } from "../../../../shared/src/race-validation";
import { useApiCaller } from "../composables/useApiCaller";
import { isCancel } from "../lib/http-client";

const { callApi } = useApiCaller();
const races = ref<Race[]>([]);
const error = ref<string | null>(null);
const controller = new AbortController();

onMounted(() => {
  callApi<Race[]>("/api/races", { signal: controller.signal })
    .then((data) => {
      races.value = data;
    })
    .catch((err: unknown) => {
      if (isCancel(err)) return;
      console.error(err);
      error.value = "レース一覧の取得に失敗しました";
    });
});

// 一覧が返る前に画面を離れたら通信を打ち切る
onUnmounted(() => controller.abort());
</script>

<template>
  <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>

  <ul v-else class="mt-4 space-y-1 text-sm text-slate-700">
    <li v-for="race in races" :key="race.id">
      {{ race.name }}（{{ race.venue }}／出走 {{ race.entries.length }} 頭）
    </li>
  </ul>
</template>
