<template>
  <div class="app-layout">
    <AppHeader />

    <div class="app-main">
      <!-- 紧凑状态条 -->
      <StatusBar :status="status" @updated="loadStatus" />

      <!-- 内容区域：左侧面板 + 右侧日志 -->
      <div class="content-area">
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
