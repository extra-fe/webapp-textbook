<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { apiClient, isCancel } from "../lib/http-client";

interface Announcement {
  id: string;
  title: string;
  body: string;
  level: string;
  startsAt: string;
  endsAt: string;
}

const announcements = ref<Announcement[]>([]);
const controller = new AbortController();

onMounted(() => {
  void apiClient
    .get<Announcement[]>(
      `${import.meta.env.VITE_API_BASE_URL}/api/guest/announcements`,
      { signal: controller.signal },
    )
    .then((res) => {
      announcements.value = res.data;
    })
    .catch((e: unknown) => {
      if (isCancel(e)) return;
      // お知らせ取得の失敗はサイレントに扱う（非クリティカル）
      console.debug("[AnnouncementList] 取得に失敗しました", e);
    });
});

onUnmounted(() => controller.abort());
</script>

<template>
  <ul v-if="announcements.length" class="space-y-2">
    <li
      v-for="a in announcements"
      :key="a.id"
      :data-level="a.level"
      class="rounded border px-3 py-2 text-left text-sm"
      :class="
        a.level === 'warning'
          ? 'border-yellow-400 bg-yellow-50 text-yellow-900'
          : a.level === 'error'
            ? 'border-red-400 bg-red-50 text-red-900'
            : 'border-blue-400 bg-blue-50 text-blue-900'
      "
    >
      <p class="font-bold">{{ a.title }}</p>
      <p class="mt-1 whitespace-pre-line text-xs">{{ a.body }}</p>
    </li>
  </ul>
</template>
