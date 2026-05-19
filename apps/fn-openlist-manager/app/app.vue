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
            <el-descriptions :column="2" border>
              <el-descriptions-item label="版本">{{ status.version }}</el-descriptions-item>
              <el-descriptions-item label="运行状态">
                <el-tag :type="status.running ? 'success' : 'danger'">
                  {{ status.running ? "运行中" : "未运行" }}
                </el-tag>
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
              <el-select v-model="selectedVersion" placeholder="最新版本" clearable class="version-select">
                <el-option v-for="v in availableVersions" :key="v" :label="v === availableVersions[0] ? `${v} (最新)` : v" :value="v" />
              </el-select>
              <el-input v-model="mirrorUrl" placeholder="镜像地址（留空使用默认代理）" class="mirror-input" />
              <el-button type="primary" :loading="updating" @click="handleUpdate">
                {{ selectedVersion && selectedVersion !== availableVersions[0] ? `安装 ${selectedVersion}` : "检查并更新" }}
              </el-button>
            </div>
            <div v-if="updating" class="update-progress">
              <el-progress :percentage="progressPercent" :stroke-width="18" :text-inside="true" :status="progressStatus" />
              <div class="update-step">{{ progressStepText }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="mt-4">
        <!-- 密码管理 -->
        <el-col :xs="24" :sm="24" :md="12">
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
        <el-col :xs="24" :sm="24" :md="12">
          <el-card>
            <template #header>配置备份</template>
            <div class="card-content">
              <el-button type="success" @click="handleBackup" :loading="backupLoading">
                立即备份
              </el-button>
              <el-button @click="fetchBackups">刷新备份列表</el-button>
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
const status = ref({ version: "加载中...", running: false });
const selectedVersion = ref("");
const availableVersions = ref<string[]>([]);
const mirrorUrl = ref("");
const updating = ref(false);
const progressPercent = ref(0);
const progressStep = ref("");

const progressStatus = computed<"success" | "exception" | "warning" | "">(() => {
  if (progressStep.value === "done") return "success";
  if (progressStep.value === "error") return "exception";
  return "";
});

const progressStepText = computed(() => {
  const map: Record<string, string> = {
    download: `下载中... ${progressPercent.value}%`,
    extract: "解压中...",
    install: "安装中...",
    done: "安装完成",
    error: "更新失败",
  };
  return map[progressStep.value] || "准备中...";
});
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
    status.value = { version: "加载失败", running: false };
  }
}

// 更新
async function handleUpdate() {
  updating.value = true;
  progressPercent.value = 0;
  progressStep.value = "";

  try {
    const response = await fetch("/api/openlist/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mirror: mirrorUrl.value || undefined, version: selectedVersion.value || undefined }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法读取响应");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = JSON.parse(line.slice(5));

        if (data.event === "done") {
          progressStep.value = "done";
          progressPercent.value = 100;
          ElMessage.success(`更新成功，当前版本: ${data.version}`);
          await loadStatus();
        } else if (data.event === "error") {
          progressStep.value = "error";
          ElMessage.error(data.message || "更新失败");
        } else if (data.step) {
          progressStep.value = data.step;
          progressPercent.value = data.percent ?? 0;
        }
      }
    }
  } catch (e: any) {
    progressStep.value = "error";
    ElMessage.error(e?.message || "更新失败");
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
  fetchVersions();
});

async function fetchVersions() {
  try {
    const res = await $fetch("/api/openlist/versions");
    availableVersions.value = (res as any).versions || [];
    // First version is latest, set as default
    if (availableVersions.value.length > 0) {
      selectedVersion.value = "";
    }
  } catch {
    // ignore
  }
}
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
  padding: 20px 16px;
  overflow-x: hidden;
}

.card-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.update-progress {
  margin-top: 16px;
}

.update-step {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
  text-align: center;
}

.version-select {
  width: 140px;
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
