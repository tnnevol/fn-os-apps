<template>
  <div class="status-bar">
    <div class="status-pills">
      <div class="status-pill">
        <span class="label">版本</span>
        <span class="value">{{ status.version || "——" }}</span>
      </div>
      <div class="status-pill">
        <span class="label">端口</span>
        <span class="value">{{ status.port || "——" }}</span>
      </div>
      <div class="status-pill">
        <span
          class="status-dot"
          :class="status.running ? 'running' : 'stopped'"
        ></span>
        <span class="label">状态</span>
        <span
          class="value"
          :style="{
            color: status.running ? 'var(--ol-success)' : 'var(--ol-danger)',
          }"
        >
          {{ status.running ? "运行中" : "未运行" }}
        </span>
      </div>
    </div>
    <div class="status-actions">
      <slot name="actions" />
      <el-button
        :size="btnSize"
        type="primary"
        :disabled="!status.running || !status.port"
        @click="handleOpen"
        :loading="loading"
        class="status-btn"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        打开
      </el-button>
      <el-button
        :size="btnSize"
        type="success"
        @click="handleToggle"
        :loading="loading"
        class="status-btn"
      >
        <svg v-if="status.running" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {{ status.running ? "停止" : "启动" }}
      </el-button>
      <el-button
        :size="btnSize"
        @click="handleRestart"
        :loading="loading"
        class="status-btn status-btn-glass"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        重启
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { apiFetch } from "../composables/api";
import { ref, computed } from "vue";
import { useWindowSize } from "@vueuse/core";

const props = defineProps<{
  status: { version: string; running: boolean; port: number | null };
}>();

const emit = defineEmits<{
  (e: "updated"): void;
}>();

const { width } = useWindowSize();
const btnSize = computed(() =>
  width.value >= 768 ? "default" : ("small" as const),
);

const loading = ref(false);

function handleOpen() {
  if (!props.status.port) return;
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname;
  window.open(`${protocol}://${host}:${props.status.port}`, "_blank");
}

async function handleToggle() {
  loading.value = true;
  try {
    if (props.status.running) {
      await apiFetch("stop", { method: "POST" });
      ElMessage.success("openlist 已停止");
    } else {
      await apiFetch("start", { method: "POST" });
      ElMessage.success("openlist 已启动");
    }
    emit("updated");
  } catch (e: any) {
    ElMessage.error(
      e?.data?.message || (props.status.running ? "停止失败" : "启动失败"),
    );
  } finally {
    loading.value = false;
  }
}

async function handleRestart() {
  loading.value = true;
  try {
    await apiFetch("restart", { method: "POST" });
    ElMessage.success("openlist 已重启");
    emit("updated");
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "重启失败");
  } finally {
    loading.value = false;
  }
}
</script>
