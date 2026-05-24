<template>
  <div class="status-bar">
    <div class="status-items">
      <div class="status-item">
        <el-icon size="14" color="#7c6ef0"><Tickets /></el-icon>
        <span class="status-label">版本</span>
        <span class="status-value">{{ status.version || "——" }}</span>
      </div>
      <div class="status-item">
        <el-icon size="14" color="var(--ol-success)"><Connection /></el-icon>
        <span class="status-label">端口</span>
        <span class="status-value">{{ status.port || "——" }}</span>
      </div>
      <div class="status-item">
        <span class="status-dot" :class="status.running ? 'running' : 'stopped'"></span>
        <span class="status-label">状态</span>
        <span class="status-value" :style="{ color: status.running ? 'var(--ol-success)' : 'var(--ol-danger)' }">
          {{ status.running ? "运行中" : "未运行" }}
        </span>
      </div>
    </div>
    <div class="status-actions">
      <el-button size="small" type="primary" :disabled="!status.running || !status.port" @click="handleOpen" :loading="loading">
        打开
      </el-button>
      <el-button size="small" type="success" @click="handleStart" :loading="loading" :disabled="status.running">
        启动
      </el-button>
      <el-button size="small" type="danger" @click="handleStop" :loading="loading" :disabled="!status.running">
        停止
      </el-button>
      <el-button size="small" @click="handleRestart" :loading="loading">
        重启
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Tickets, Connection } from "@element-plus/icons-vue";

const props = defineProps<{
  status: { version: string; running: boolean; port: number | null };
}>();

const emit = defineEmits<{
  (e: "updated"): void;
}>();

const loading = ref(false);

function handleOpen() {
  if (!props.status.port) return;
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname;
  window.open(`${protocol}://${host}:${props.status.port}`, "_blank");
}

async function handleStart() {
  loading.value = true;
  try {
    await $fetch("/api/openlist/start", { method: "POST" });
    ElMessage.success("openlist 已启动");
    emit("updated");
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "启动失败");
  } finally {
    loading.value = false;
  }
}

async function handleStop() {
  loading.value = true;
  try {
    await $fetch("/api/openlist/stop", { method: "POST" });
    ElMessage.success("openlist 已停止");
    emit("updated");
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "停止失败");
  } finally {
    loading.value = false;
  }
}

async function handleRestart() {
  loading.value = true;
  try {
    await $fetch("/api/openlist/restart", { method: "POST" });
    ElMessage.success("openlist 已重启");
    emit("updated");
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "重启失败");
  } finally {
    loading.value = false;
  }
}
</script>
