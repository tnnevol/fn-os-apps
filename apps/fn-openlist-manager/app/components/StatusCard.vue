<template>
  <el-card>
    <template #header>
      <div class="flex items-center justify-between">
        <span>系统状态</span>
        <div class="flex gap-2">
          <el-button size="small" type="primary" :disabled="!status.running" @click="handleOpen" :loading="loading">
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
    <el-descriptions :column="isMobile ? 1 : 2" border>
      <el-descriptions-item label="版本">{{ status.version }}</el-descriptions-item>
      <el-descriptions-item label="端口">{{ status.port }}</el-descriptions-item>
      <el-descriptions-item label="运行状态">
        <el-tag :type="status.running ? 'success' : 'danger'">
          {{ status.running ? "运行中" : "未运行" }}
        </el-tag>
      </el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<script setup lang="ts">
const props = defineProps<{
  status: { version: string; running: boolean; port: number };
}>();

const emit = defineEmits<{
  (e: "updated"): void;
}>();

const isMobile = useMediaQuery("(max-width: 767px)");
const loading = ref(false);

function handleOpen() {
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
