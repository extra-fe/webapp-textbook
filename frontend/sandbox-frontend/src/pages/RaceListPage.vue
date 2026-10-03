<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type {
  CreateRaceFormValues,
  Race,
} from "../../../../shared/src/race-validation";
import { useToast } from "../components/toast-context";
import {
  ApiError,
  ConflictHandledError,
  useApiCaller,
} from "../composables/useApiCaller";
import { isCancel } from "../lib/http-client";
import RaceCreateForm from "./RaceCreateForm.vue";

const { showSuccess, showError } = useToast();
const { t } = useI18n();

// t() は setup の中でしか呼べないので、ロケールから引く版は
// 純粋な関数として切り出せずここに置く
const toUserMessage = (err: ApiError): string => {
  switch (err.status) {
    case 400:
      return t("common.error.BAD_REQUEST");
    case 401:
      return t("common.error.UNAUTHORIZED");
    case 403:
      return t("common.error.FORBIDDEN");
    case 404:
      return t("common.error.NOT_FOUND");
    case 409:
      return t("common.error.CONFLICT");
    default:
      return err.status >= 500
        ? t("common.error.SERVER_ERROR")
        : t("common.error.UNKNOWN");
  }
};

// onConflict は fetchRaces を呼ぶ。fetchRaces はこの下で定義しているが、
// 409 が起きるのは必ず定義後なので、そのまま参照してよい
const { callApi } = useApiCaller({
  onConflict: () => fetchRaces(),
});

const races = ref<Race[]>([]);
const selectedRaceId = ref<string | null>(null);
const error = ref<string | null>(null);
const controller = new AbortController();

// selectedRace は races から導出する（別の ref を持たない）
const selectedRace = computed(
  () => races.value.find((r) => r.id === selectedRaceId.value) ?? null,
);

async function fetchRaces(signal?: AbortSignal) {
  races.value = await callApi<Race[]>("/api/races", { signal });
}

const fetchRace = async (id: string) => {
  selectedRaceId.value = id;
  const detail = await callApi<Race>(`/api/races/${id}`);
  // races 配列内の該当エントリを最新の詳細データで更新する
  races.value = races.value.map((r) => (r.id === id ? detail : r));
  // selectedRace は computed が自動的に最新の races から再計算する
};

const renameVenue = async (race: Race) => {
  try {
    await callApi(`/api/races/${race.id}?version=${race.version}`, {
      method: "PATCH",
      body: { venue: `${race.venue}競馬場` },
    });
    await fetchRaces();
    showSuccess(t("race.list.updateSuccess"));
  } catch (err: unknown) {
    // 409 は useApiCaller 内で再同期済みなので、ここでは何もしない
    if (err instanceof ConflictHandledError) return;
    if (err instanceof ApiError) showError(toUserMessage(err));
    else console.error(err);
  }
};

onMounted(() => {
  fetchRaces(controller.signal).catch((err: unknown) => {
    if (isCancel(err)) return;
    console.error(err);
    error.value = t("race.list.fetchError");
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
    <li v-for="race in races" :key="race.id" class="flex items-center gap-2">
      <button
        type="button"
        class="text-left underline-offset-2 hover:underline"
        :class="{ 'font-bold': race.id === selectedRaceId }"
        @click="fetchRace(race.id)"
      >
        v{{ race.version }} {{ race.name }}（{{ race.venue }}／出走
        {{ race.entries.length }} 頭）
      </button>
      <button
        type="button"
        class="rounded border border-slate-300 px-1 text-xs text-slate-600"
        @click="renameVenue(race)"
      >
        {{ t("race.list.renameButton") }}
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
