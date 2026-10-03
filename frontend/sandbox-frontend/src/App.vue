<script setup lang="ts">
import { RouterView } from "vue-router";
import ErrorBoundary from "./components/ErrorBoundary.vue";
import ToastHost from "./components/ToastHost.vue";
</script>

<template>
  <!-- ErrorBoundary は RouterView を囲む位置に置く。最上位に置くと
       エラー時にトーストの出口ごと失われる -->
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
  <ToastHost />
</template>
