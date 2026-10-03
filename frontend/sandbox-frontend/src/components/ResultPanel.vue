<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { Race } from "../../../../shared/src/race-validation";
import PlaceholderArea from "./PlaceholderArea.vue";
import RaceDetailCard from "./RaceDetailCard.vue";

defineProps<{ race: Race | null; loading: boolean }>();
const emit = defineEmits<{ close: [] }>();
// t() は 3.6節で導入した vue-i18n のもの
const { t } = useI18n();
</script>

<template>
  <section
    :aria-label="t('race.resultPanel.label')"
    aria-live="polite"
    class="mt-8 min-h-[200px]"
  >
    <p v-if="loading">{{ t("race.list.detailLoading") }}</p>
    <RaceDetailCard v-else-if="race" :race="race" @close="emit('close')" />
    <PlaceholderArea v-else />
  </section>
</template>
