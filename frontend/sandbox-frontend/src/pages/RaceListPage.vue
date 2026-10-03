<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type {
  CreateRaceFormValues,
  Race,
} from "../../../../shared/src/race-validation";
import { useApiCaller } from "../composables/useApiCaller";
import { isCancel } from "../lib/http-client";
import RaceCreateForm from "./RaceCreateForm.vue";

const { callApi } = useApiCaller();
const races = ref<Race[]>([]);
const error = ref<string | null>(null);
const controller = new AbortController();

const fetchRaces = async () => {
  races.value = await callApi<Race[]>("/api/races", {
    signal: controller.signal,
  });
};

onMounted(() => {
  fetchRaces().catch((err: unknown) => {
    if (isCancel(err)) return;
    console.error(err);
    error.value = "レース一覧の取得に失敗しました";
  });
});

// フォームは YYYY-MM-DD を返す。API は ISO8601 を要求するので、
// API を呼ぶ側であるこちらで変換する。
const onSubmit = async (values: CreateRaceFormValues) => {
  await callApi("/api/races", {
    method: "POST",
    body: {
      date: `${values.date}T00:00:00.000Z`,
      name: values.name,
      venue: values.venue,
      entries: [],
    },
  });
  await fetchRaces();
};

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

  <RaceCreateForm :on-submit="onSubmit" />
</template>
