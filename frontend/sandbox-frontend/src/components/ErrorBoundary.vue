<script setup lang="ts">
import { onErrorCaptured, ref } from "vue";
import { useI18n } from "vue-i18n";

const isDev = import.meta.env.DEV;
const { t } = useI18n();

const error = ref<Error | null>(null);

/**
 * 配下の描画・ライフサイクルで投げられたエラーを捕捉してフォールバックを出す。
 *
 * React のクラスコンポーネント（getDerivedStateFromError / componentDidCatch）に
 * あたるものが onErrorCaptured。React の ErrorBoundary が捕まえられなかった
 * onMounted や watch、イベントハンドラの throw もここで捕まる。
 * return false で伝播を止めるため、app.config.errorHandler には上がらない。
 */
onErrorCaptured((err) => {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error("[ErrorBoundary] Uncaught error:", e);
  // ここで監視サービスへ送る。可観測性の作り込みは下巻で扱う
  error.value = e;
  return false;
});

const retry = () => {
  error.value = null;
};
</script>

<template>
  <!-- fallback スロットが差し込まれていればそちらを出す -->
  <slot v-if="error && $slots.fallback" name="fallback" :error="error" />

  <div
    v-else-if="error"
    role="alert"
    class="flex min-h-screen flex-col items-center justify-center p-8 text-center"
  >
    <h1 class="text-2xl font-bold text-red-700">{{ t("error.heading") }}</h1>
    <p class="mt-2 text-sm text-slate-600">{{ t("error.message") }}</p>
    <div class="mt-6 flex flex-wrap justify-center gap-3">
      <button
        type="button"
        class="rounded bg-red-700 px-4 py-2 text-sm text-white"
        @click="retry"
      >
        {{ t("error.retry") }}
      </button>
      <a href="/" class="rounded bg-slate-900 px-4 py-2 text-sm text-white">
        {{ t("error.backToHome") }}
      </a>
    </div>
    <!-- 本番では詳細を出さない。内部情報が利用者に漏れるため -->
    <details v-if="isDev" class="mt-8 w-full max-w-3xl text-left">
      <summary class="cursor-pointer text-xs text-slate-500">
        {{ t("error.stackTrace") }}
      </summary>
      <pre
        class="mt-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs break-all whitespace-pre-wrap"
        >{{ error.stack ?? error.message }}</pre
      >
    </details>
  </div>

  <slot v-else />
</template>
