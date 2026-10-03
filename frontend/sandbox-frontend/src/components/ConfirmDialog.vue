<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title: string;
    message: string;
    isLoading?: boolean;
    // 文言は既定でロケールから引き、必要な画面だけ上書きできるようにする
    confirmLabel?: string;
    cancelLabel?: string;
  }>(),
  { isLoading: false },
);
const emit = defineEmits<{ confirm: []; cancel: [] }>();

// t() は 3.6節で導入した vue-i18n のもの
const { t } = useI18n();
const dialog = ref<HTMLElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
const titleId = useId();

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusCancel = () => cancelButton.value?.focus();

// 開いたときにキャンセルボタンへフォーカスを移す（DOM 更新後に実行）
watch(
  () => props.isOpen,
  (open) => {
    if (open) focusCancel();
  },
  { flush: "post" },
);
onMounted(() => {
  if (props.isOpen) focusCancel();
});

// Escape でキャンセル ＋ Tab フォーカストラップ（先頭/末尾をループ）
const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;

  if (e.key === "Escape") {
    emit("cancel");
    return;
  }
  if (e.key !== "Tab" || !dialog.value) return;

  const focusable = [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown);
});
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  >
    <div
      ref="dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
    >
      <h2 :id="titleId" class="mb-2 text-lg font-semibold text-slate-900">
        {{ title }}
      </h2>
      <p class="mb-6 text-sm text-slate-600">{{ message }}</p>
      <div class="flex justify-end gap-3">
        <!-- 文言はロケールから引く。呼び出し側から差し替えたいときだけ props で上書きする -->
        <button
          ref="cancelButton"
          type="button"
          :disabled="isLoading"
          class="rounded border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
          @click="emit('cancel')"
        >
          {{ cancelLabel ?? t("common.dialog.cancel") }}
        </button>
        <button
          type="button"
          :disabled="isLoading"
          class="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? t("common.dialog.confirm") }}
        </button>
      </div>
    </div>
  </div>
</template>
