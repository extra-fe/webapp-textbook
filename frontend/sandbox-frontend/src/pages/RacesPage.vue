<script setup lang="ts">
import { RouterLink } from "vue-router";
import PageContainer from "../components/PageContainer.vue";
import ProtectedRoute from "../components/ProtectedRoute.vue";
import { ROUTES } from "../routes";
import RaceListPage from "./RaceListPage.vue";
</script>

<template>
  <PageContainer>
    <RouterLink :to="ROUTES.HOME.path" class="text-sm underline underline-offset-2">
      ホームへ
    </RouterLink>

    <!-- バックエンドの RaceController と同じロール要件を画面側にも置く -->
    <ProtectedRoute :required-roles="['admin', 'operator', 'viewer']">
      <RaceListPage />
    </ProtectedRoute>
  </PageContainer>
</template>
