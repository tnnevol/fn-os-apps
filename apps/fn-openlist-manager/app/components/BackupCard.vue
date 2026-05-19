<template>
  <el-card>
    <template #header>配置备份</template>
    <div class="flex flex-wrap gap-2">
      <el-button type="success" @click="handleBackup" :loading="loading">
        立即备份
      </el-button>
      <el-button @click="fetchBackups">刷新备份列表</el-button>
    </div>
    <div class="mt-2 max-h-[200px] overflow-y-auto">
      <el-table :data="backups" class="w-full">
      <el-table-column prop="name" label="备份名称" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="handleRestore(row.name)">
            恢复
          </el-button>
        </template>
      </el-table-column>
      </el-table>
    </div>
  </el-card>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: "restored"): void;
}>();

const loading = ref(false);
const backups = ref<any[]>([]);

async function fetchBackups() {
  try {
    backups.value = await $fetch("/api/openlist/backups");
  } catch {
    backups.value = [];
  }
}

async function handleBackup() {
  loading.value = true;
  try {
    const res = await $fetch("/api/openlist/backup", { method: "POST" });
    ElMessage.success(`备份成功: ${(res as any).path}`);
    await fetchBackups();
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "备份失败");
  } finally {
    loading.value = false;
  }
}

async function handleRestore(name: string) {
  try {
    await ElMessageBox.confirm("恢复配置将覆盖当前数据，是否继续？", "确认恢复", {
      type: "warning",
    });
    await $fetch("/api/openlist/restore", {
      method: "POST",
      body: { backupName: name },
    });
    ElMessage.success("恢复成功");
    emit("restored");
    await fetchBackups();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e?.data?.message || "恢复失败");
    }
  }
}

onMounted(() => {
  fetchBackups();
});
</script>
