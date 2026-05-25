<template>
  <div class="app-layout">
    <AppHeader />

    <div class="app-main">
      <!-- 紧凑状态条 -->
      <StatusBar :status="status" @updated="loadStatus" />

      <!-- 内容区域：左侧面板 + 右侧日志 -->
      <div class="content-area flex-1 flex flex-row lt-sm:flex-col gap-3 px-5 pt-3 pb-4 overflow-hidden lt-sm:overflow-y-auto min-h-0 bg-[var(--ol-bg)]">
        <!-- 左侧面板栈 -->
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

        <!-- 右侧日志区域 -->
        <div class="log-area">
          <LogCard />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const status = ref({
  version: "加载中...",
  running: false,
  port: null as number | null,
});

async function loadStatus() {
  try {
    status.value = await $fetch("/api/openlist/status");
  } catch {
    status.value = { version: "加载失败", running: false, port: null };
  }
}

onMounted(() => {
  loadStatus();
});
</script>
