<template>
  <el-card>
    <template #header>
      <span
        ><span class="card-icon update"
          ><el-icon><Download /></el-icon></span
        >更新 OpenList</span
      >
    </template>
    <div class="flex items-center gap-2">
      <el-autocomplete
        v-model="selectedVersion"
        :fetch-suggestions="fetchSuggestions"
        placeholder="版本号或留空装 latest"
        clearable
        :size="controlSize"
        class="w-full sm:!w-auto"
      />
      <el-button
        type="primary"
        :size="controlSize"
        :loading="updating"
        @click="handleUpdate"
      >
        安装
      </el-button>
    </div>
    <div class="mt-2">
      <el-input
        v-model="mirrorUrl"
        placeholder="镜像地址，留空默认"
        :size="controlSize"
      />
    </div>
    <div v-if="updating" class="mt-2">
      <el-progress
        :percentage="progressPercent"
        :stroke-width="12"
        :text-inside="true"
        :status="progressStatus"
      />
      <div class="mt-1 text-center text-xs text-muted">
        {{ progressStepText }}
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Download } from "@element-plus/icons-vue";
import { useWindowSize } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { apiFetch } from "../composables/api";

const emit = defineEmits<{
  (e: "updated"): void;
}>();

const { width } = useWindowSize();
const controlSize = computed(() =>
  width.value >= 768 ? "default" : ("small" as const),
);

const selectedVersion = ref("");
const mirrorUrl = ref("");
const updating = ref(false);
const progressPercent = ref(0);
const progressStep = ref("");
const availableVersions = ref<string[]>([]);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchVersions() {
  try {
    const res = await apiFetch("versions");
    const versions = (res as any).versions || [];
    versions[0] = "latest";
    availableVersions.value = versions;
    selectedVersion.value = availableVersions.value[0] ?? "latest";
  } catch {
    // ignore
  }
}

const progressStatus = computed<"success" | "exception" | "warning" | "">(
  () => {
    if (progressStep.value === "done") return "success";
    if (progressStep.value === "error") return "exception";
    return "";
  },
);

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

interface VersionItem {
  value: string;
}

function fetchSuggestions(query: string, cb: (items: VersionItem[]) => void) {
  if (!availableVersions.value.length) {
    cb([{ value: "latest" }]);
    return;
  }
  const allItems = availableVersions.value.map((v) => ({ value: v }));
  if (!query || query === selectedVersion.value) {
    cb(allItems);
    return;
  }
  const q = query.toLowerCase();
  const filtered = allItems.filter((item) =>
    item.value.toLowerCase().includes(q),
  );
  cb(filtered.length ? filtered : [{ value: "latest" }]);
}

async function handleUpdate() {
  updating.value = true;
  progressPercent.value = 0;
  progressStep.value = "";

  const version = selectedVersion.value || undefined;
  const body: Record<string, string> = {};
  if (mirrorUrl.value) body.mirror = mirrorUrl.value;
  if (version) body.version = version;

  // Fire-and-forget: install is long-running, don't await the response
  apiFetch("install", { method: "POST", body }).catch(() => {});

  // Poll for progress
  pollTimer = setInterval(async () => {
    try {
      const data = await apiFetch("install_progress");
      if (data.done) {
        clearInterval(pollTimer!);
        pollTimer = null;
        progressStep.value = "done";
        progressPercent.value = 100;
        ElMessage.success(`安装成功，当前版本: ${data.version}`);
        emit("updated");
        updating.value = false;
      } else if (data.error) {
        clearInterval(pollTimer!);
        pollTimer = null;
        progressStep.value = "error";
        ElMessage.error(data.error || "安装失败");
        updating.value = false;
      } else if (data.step) {
        progressStep.value = data.step;
        progressPercent.value = data.percent ?? 0;
      }
    } catch {
      // retry next interval
    }
  }, 1500);
}

watch(mirrorUrl, () => {
  fetchVersions();
});

onMounted(() => {
  fetchVersions();
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>
