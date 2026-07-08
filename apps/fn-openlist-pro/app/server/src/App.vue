<template>
  <div class="app-layout">
    <!-- Extra mesh blobs for vivid glassmorphism background -->
    <div class="mesh-blob-c"></div>
    <div class="mesh-blob-d"></div>
    <el-container>
      <el-header class="app-header">
        <StatusBar :status="status" @updated="loadStatus">
          <template #actions>
            <el-tooltip
              :content="isDark ? '切换浅色' : '切换暗黑'"
              placement="bottom"
              :show-arrow="false"
            >
              <button class="theme-toggle-btn" @click="toggleDark">
                <svg
                  v-if="!isDark"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <svg
                  v-else
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </button>
            </el-tooltip>
          </template>
        </StatusBar>
      </el-header>
      <el-container>
        <el-aside width="200px">
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
        </el-aside>
        <el-main class="app-main">
          <LogCard />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { apiFetch } from "./composables/api";
import useDarkMode from "./composables/useDarkMode";
import StatusBar from "./components/StatusBar.vue";
import UpdateCard from "./components/UpdateCard.vue";
import PasswordCard from "./components/PasswordCard.vue";
import BackupCard from "./components/BackupCard.vue";
import LogCard from "./components/LogCard.vue";

const { isDark, toggleDark } = useDarkMode();

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

<style scoped lang="scss">
.app-layout {
  background: var(--bg);
}
</style>
