<script setup lang="ts">
import { computed, watch } from "vue";
import { useAuth } from "../auth/auth-context";
import { type UserRole, usePermissions } from "../composables/usePermissions";

const props = defineProps<{ requiredRoles?: UserRole[] }>();

const { isAuthenticated, isLoading, login } = useAuth();
const { hasRole } = usePermissions();

const lacksRequiredRole = computed(
  () => !!props.requiredRoles?.length && !hasRole(...props.requiredRoles),
);

const state = computed<"forbidden" | "loading" | "login" | "ok">(() => {
  if (isLoading.value) return "loading";
  if (!isAuthenticated.value) return "login";
  return lacksRequiredRole.value ? "forbidden" : "ok";
});

// 未認証ならIdPのログイン画面へ送る。immediate: true で
// 「最初から未認証」と「判定が終わって未認証だった」の両方を拾う。
watch(
  state,
  (s) => {
    if (s === "login") login();
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="state === 'forbidden'" class="text-sm text-red-600">
    403 Forbidden
  </div>
  <div v-else-if="state === 'loading'" class="text-sm text-slate-600">
    Loading...
  </div>
  <!-- state === 'login' のときは何も描かず、login() のリダイレクトを待つ -->
  <slot v-else-if="state === 'ok'" />
</template>
