<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type {
  CreateRaceFormValues,
  Race,
} from "../../../../shared/src/race-validation";
import { useApiCaller } from "../composables/useApiCaller";
import { isCancel } from "../lib/http-client";
import RaceCreateForm from "./RaceCreateForm.vue";

const { callApi } = useApiCaller();
const races = ref<Race[]>([]);
const selectedRaceId = ref<string | null>(null);
const error = ref<string | null>(null);
const controller = new AbortController();

// selectedRace は races から導出する（別の ref を持たない）
const selectedRace = computed(
  () => races.value.find((r) => r.id === selectedRaceId.value) ?? null,
);

const fetchRaces = async () => {
  races.value = await callApi<Race[]>("/api/races", {
    signal: controller.signal,
  });
};

const fetchRace = async (id: string) => {
  selectedRaceId.value = id;
  const detail = await callApi<Race>(`/api/races/${id}`);
  // races 配列内の該当エントリを最新の詳細データで更新する
  races.value = races.value.map((r) => (r.id === id ? detail : r));
  // selectedRace は computed が自動的に最新の races から再計算する
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
      <button
        type="button"
        class="text-left underline-offset-2 hover:underline"
        :class="{ 'font-bold': race.id === selectedRaceId }"
        @click="fetchRace(race.id)"
      >
        {{ race.name }}（{{ race.venue }}／出走 {{ race.entries.length }} 頭）
      </button>
    </li>
  </ul>

  <section v-if="selectedRace" class="mt-4 rounded border border-slate-200 p-3">
    <h2 class="text-sm font-bold text-slate-900">{{ selectedRace.name }}</h2>
    <p class="text-xs text-slate-600">{{ selectedRace.venue }}</p>
    <ol class="mt-1 text-xs text-slate-700">
      <li v-for="entry in selectedRace.entries" :key="entry.id">
        {{ entry.horseNumber }}. {{ entry.horseName }}（{{ entry.jockey }}）
      </li>
    </ol>
  </section>

  <RaceCreateForm :on-submit="onSubmit" />
</template>
