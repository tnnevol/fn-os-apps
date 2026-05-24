<template>
  <el-card>
    <template #header>
      <span><span class="card-icon backup"><el-icon><Document /></el-icon></span>配置备份</span>
    </template>
    <el-button type="success" @click="handleBackup" :loading="loading" style="width: 100%">
      立即备份
    </el-button>
  </el-card>
</template>

<script setup lang="ts">
import { Document } from "@element-plus/icons-vue";

const loading = ref(false);

async function handleBackup() {
  loading.value = true;
  try {
    const res = await fetch("/api/openlist/backup", { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "备份失败");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openlist-backup-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success("备份成功，文件已开始下载");
  } catch (e: any) {
    ElMessage.error(e?.message || "备份失败");
  } finally {
    loading.value = false;
  }
}
</script>
