<script setup lang="ts">
import { inject, ref } from "vue";
import { type Toast, toastListKey } from "./toast-context";

const toasts = inject(toastListKey, ref<Toast[]>([]));
</script>

<template>
  <div role="status" aria-live="polite" class="fixed right-4 bottom-4 space-y-2">
    <p
      v-for="toast in toasts"
      :key="toast.id"
      :data-kind="toast.kind"
      class="rounded px-3 py-2 text-sm text-white shadow"
      :class="toast.kind === 'success' ? 'bg-emerald-600' : 'bg-red-600'"
    >
      {{ toast.message }}
    </p>
  </div>
</template>
