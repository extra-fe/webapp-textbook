<script setup lang="ts">
const props = defineProps<{ class?: string }>();
</script>

<template>
  <div :class="['mx-auto w-full max-w-5xl px-4 py-8 sm:px-6', props.class]">
    <slot />
  </div>
</template>
