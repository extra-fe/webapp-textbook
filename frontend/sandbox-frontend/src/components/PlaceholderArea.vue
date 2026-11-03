<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div
    class="flex h-[200px] items-center justify-center rounded border border-dashed border-slate-300 text-sm text-slate-400"
  >
    {{ t("race.resultPanel.placeholder") }}
  </div>
</template>
