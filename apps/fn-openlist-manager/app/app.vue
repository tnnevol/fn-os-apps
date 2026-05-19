<template>
  <div class="app-container">
    <el-header class="header">
      <h1>OpenList 管理面板</h1>
    </el-header>

    <el-main class="main">
      <el-row :gutter="20">
        <!-- 状态卡片 -->
        <el-col :span="24">
          <el-card>
            <template #header>系统状态</template>
            <el-descriptions :column="3" border>
              <el-descriptions-item label="版本">{{ status.version }}</el-descriptions-item>
              <el-descriptions-item label="运行状态">
                <el-tag :type="status.running ? 'success' : 'danger'">
                  {{ status.running ? "运行中" : "未运行" }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="配置">
                {{ status.config ? "已加载" : "未加载" }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="mt-4">
        <!-- 更新 -->
        <el-col :span="24">
          <el-card>
            <template #header>更新 OpenList</template>
            <div class="card-content">
              <el-input v-model="mirrorUrl" placeholder="镜像地址（留空使用默认代理）" class="mirror-input" />
              <el-button type="primary" :loading="updating" @click="handleUpdate" class="ml-2">
                检查并更新
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="mt-4">
        <!-- 密码管理 -->
        <el-col :span="12">
          <el-card>
            <template #header>密码管理</template>
            <div class="card-content">
              <el-button @click="handleRandomPassword" :loading="passwordLoading" class="mb-2">
                随机生成密码
              </el-button>
              <el-input v-model="customPassword" placeholder="自定义密码" clearable class="mb-2" />
              <el-button type="warning" @click="handleSetPassword" :loading="passwordLoading">
                设置密码
              </el-button>
            </div>
            <el-alert v-if="randomPassword" type="success" :closable="false" class="mt-2">
              新密码: <strong>{{ randomPassword }}</strong>
            </el-alert>
          </el-card>
        </el-col>

        <!-- 配置备份 -->
        <el-col :span="12">
          <el-card>
            <template #header>配置备份</template>
            <div class="card-content">
              <el-button type="success" @click="handleBackup" :loading="backupLoading" class="mb-2">
                立即备份
              </el-button>
              <el-button @click="fetchBackups" class="ml-2">刷新备份列表</el-button>
            </div>
            <el-table :data="backups" class="mt-2 backup-table">
              <el-table-column prop="name" label="备份名称" />
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="handleRestore(row.name)">
                    恢复
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </el-main>
  </div>
</template>

<script setup lang="ts">
const status = ref({ version: "加载中...", running: false, config: null });
const mirrorUrl = ref("");
const updating = ref(false);
const customPassword = ref("");
const randomPassword = ref("");
const passwordLoading = ref(false);
const backupLoading = ref(false);
const backups = ref<any[]>([]);

// 加载状态
async function loadStatus() {
  try {
    status.value = await $fetch("/api/openlist/status");
  } catch {
    status.value = { version: "加载失败", running: false, config: null };
  }
}

// 更新
async function handleUpdate() {
  updating.value = true;
  try {
    const res = await $fetch("/api/openlist/update", {
      method: "POST",
      body: { mirror: mirrorUrl.value || undefined },
    });
    ElMessage.success(`更新成功，当前版本: ${res.version}`);
    await loadStatus();
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "更新失败");
  } finally {
    updating.value = false;
  }
}

// 密码管理
async function handleRandomPassword() {
  passwordLoading.value = true;
  try {
    const res = await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "random" },
    });
    randomPassword.value = res.password;
    ElMessage.success("密码已随机生成");
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "生成密码失败");
  } finally {
    passwordLoading.value = false;
  }
}

async function handleSetPassword() {
  const pwd = customPassword.value;
  if (!pwd) {
    ElMessage.warning("请输入密码");
    return;
  }
  passwordLoading.value = true;
  try {
    await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "set", password: pwd },
    });
    ElMessage.success("密码已设置");
    customPassword.value = "";
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "设置密码失败");
  } finally {
    passwordLoading.value = false;
  }
}

// 备份
async function handleBackup() {
  backupLoading.value = true;
  try {
    const res = await $fetch("/api/openlist/backup", { method: "POST" });
    ElMessage.success(`备份成功: ${res.path}`);
    await fetchBackups();
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "备份失败");
  } finally {
    backupLoading.value = false;
  }
}

async function fetchBackups() {
  try {
    backups.value = await $fetch("/api/openlist/backups");
  } catch {
    backups.value = [];
  }
}

async function handleRestore(name: string) {
  try {
    await ElMessageBox.confirm("恢复配置将覆盖当前数据，是否继续？", "确认恢复", {
      type: "warning",
    });
    const res = await $fetch("/api/openlist/restore", {
      method: "POST",
      body: { backupName: name },
    });
    ElMessage.success("恢复成功");
    await loadStatus();
    await fetchBackups();
  } catch (e: any) {
    if (e !== "cancel") {
      ElMessage.error(e?.data?.message || "恢复失败");
    }
  }
}

onMounted(() => {
  loadStatus();
  fetchBackups();
});
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f7fa;
  overflow-x: hidden;
}

.header {
  display: flex;
  align-items: center;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #303133;
}

.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 0;
  overflow-x: hidden;
}

.card-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.mirror-input {
  width: 300px;
}

.mt-4 {
  margin-top: 16px;
}

.mt-2 {
  margin-top: 8px;
}

.mb-2 {
  margin-bottom: 8px;
}

.backup-table {
  width: 100%;
}

.backup-table :deep(.el-table__body-wrapper) {
  max-height: 200px;
  overflow-y: auto;
}

.ml-2 {
  margin-left: 8px;
}
</style>
