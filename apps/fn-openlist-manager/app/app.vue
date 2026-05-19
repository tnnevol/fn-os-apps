<template>
  <div class="min-h-screen bg-[#f5f7fa] dark:bg-[#0a0a0a] overflow-x-hidden transition-colors">
    <AppHeader />

    <el-main class="max-w-[1200px] mx-auto px-4 py-5 md:px-6 md:py-6 overflow-x-hidden">
      <!-- 状态卡片 -->
      <StatusCard :status="status" class="mb-4 md:mb-5" />

      <!-- 更新 -->
      <UpdateCard class="mb-4 md:mb-5" @updated="loadStatus" />

      <!-- 密码管理 & 配置备份 -->
      <el-row :gutter="20">
        <el-col :xs="24" :sm="24" :md="12">
          <PasswordCard />
        </el-col>
        <el-col :xs="24" :sm="24" :md="12">
          <BackupCard @restored="loadStatus" />
        </el-col>
      </el-row>
    </el-main>
  </div>
</template>

<script setup lang="ts">
const status = ref({ version: "加载中...", running: false });

async function loadStatus() {
  try {
    status.value = await $fetch("/api/openlist/status");
  } catch {
    status.value = { version: "加载失败", running: false };
  }
}

onMounted(() => {
  loadStatus();
});
</script>
