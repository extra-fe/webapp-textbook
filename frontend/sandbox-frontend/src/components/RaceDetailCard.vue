<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { Race } from "../../../../shared/src/race-validation";

defineProps<{ race: Race }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
</script>

<template>
  <div class="rounded border border-slate-200 p-3">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-sm font-bold text-slate-900">{{ race.name }}</h2>
        <p class="text-xs text-slate-600">{{ race.venue }}</p>
      </div>
      <button
        type="button"
        class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
        @click="emit('close')"
      >
        {{ t("race.detail.closeButton") }}
      </button>
    </div>
    <ol class="mt-2 text-xs text-slate-700">
      <li v-for="entry in race.entries" :key="entry.id">
        {{ entry.horseNumber }}. {{ entry.horseName }}（{{ entry.jockey }}）
      </li>
    </ol>
  </div>
</template>
