<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import PageContainer from "../components/PageContainer.vue";
import { ROUTES } from "../routes";

const props = defineProps<{
  error?: Error | null;
  /** 渡された場合だけ「再試行」ボタンを出す */
  onRetry?: () => void;
}>();

const isDev = import.meta.env.DEV;
const { t } = useI18n();
const router = useRouter();
</script>

<template>
  <PageContainer class="text-center">
    <h1 class="text-2xl font-bold text-slate-900">{{ t("error.heading") }}</h1>
    <p class="mt-2 text-sm text-slate-600">{{ t("error.message") }}</p>
    <button
      v-if="props.onRetry"
      type="button"
      class="mt-4 rounded border border-slate-300 px-4 py-2 text-sm"
      @click="props.onRetry()"
    >
      {{ t("error.retry") }}
    </button>
    <button
      type="button"
      class="mt-4 ml-2 rounded bg-slate-900 px-4 py-2 text-sm text-white"
      @click="router.push(ROUTES.HOME.path)"
    >
      {{ t("error.backToHome") }}
    </button>
    <details v-if="isDev && props.error" class="mt-4 text-left text-xs">
      <summary>{{ t("error.stackTrace") }}</summary>
      <pre>{{ props.error.stack ?? props.error.message }}</pre>
    </details>
  </PageContainer>
</template>
