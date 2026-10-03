<script setup lang="ts">
import PageContainer from "../components/PageContainer.vue";
import ProtectedRoute from "../components/ProtectedRoute.vue";
import RaceListPage from "./RaceListPage.vue";
</script>

<template>
  <PageContainer>
    <ProtectedRoute>
      <RaceListPage />
    </ProtectedRoute>
  </PageContainer>
</template>
