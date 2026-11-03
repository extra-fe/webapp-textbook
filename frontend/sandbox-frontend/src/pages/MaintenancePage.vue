<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// .env.example は空で配るので ?? ではなく || を使う。
// ?? だと空文字が「設定済み」と見なされ、未設定時の表示に落ちない。
const scheduledEnd =
  import.meta.env.VITE_MAINTENANCE_SCHEDULED_END || undefined;

// メールアドレスは翻訳対象ではないので、ロケールファイルには置かない。
// vue-i18n はメッセージ中の "@" を linked message の記法として解釈するため、
// エスケープせずに置くとメッセージのコンパイルが失敗し、この画面が真っ白になる。
const contactEmail =
  import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com";
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 p-4">
    <div
      class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <h1 class="text-2xl font-bold text-slate-900">
        {{ t("maintenance.heading") }}
      </h1>
      <p class="mt-2 text-sm text-slate-600">{{ t("maintenance.message") }}</p>
      <p class="mt-4 text-sm text-slate-700">
        {{ t("maintenance.scheduledEnd") }}：
        {{ scheduledEnd ?? t("maintenance.scheduledEndNotSet") }}
      </p>
      <p class="mt-4 text-xs text-slate-500">
        {{ t("maintenance.contact") }}：{{ contactEmail }}
      </p>
    </div>
  </div>
</template>
