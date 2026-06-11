<template>
  <div class="app-layout">
    <!-- Extra mesh blobs for vivid glassmorphism background -->
    <div class="mesh-blob-c"></div>
    <div class="mesh-blob-d"></div>

    <AppHeader />

    <div class="app-main">
      <StatusBar :status="status" @updated="loadStatus" />

      <div
        class="content-area flex-1 flex flex-row lt-sm:flex-col gap-3 px-5 pt-3 pb-4 overflow-hidden lt-sm:overflow-y-auto min-h-0"
      >
        <div class="panel-stack">
          <div class="panel-card">
            <UpdateCard @updated="loadStatus" />
          </div>
          <div class="panel-card">
            <PasswordCard />
          </div>
          <div class="panel-card">
            <BackupCard />
          </div>
        </div>

        <LogCard />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiFetch } from "./composables/api";
import AppHeader from "./components/AppHeader.vue";
import StatusBar from "./components/StatusBar.vue";
import UpdateCard from "./components/UpdateCard.vue";
import PasswordCard from "./components/PasswordCard.vue";
import BackupCard from "./components/BackupCard.vue";
import LogCard from "./components/LogCard.vue";

const status = ref({
  version: "加载中...",
  running: false,
  port: null as number | null,
});

async function loadStatus() {
  try {
    status.value = await apiFetch("status");
  } catch {
    status.value = {
      version: "加载失败",
      running: false,
      port: null,
    };
  }
}

onMounted(() => {
  loadStatus();
});
</script>
