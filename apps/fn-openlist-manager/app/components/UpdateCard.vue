<template>
  <el-card>
    <template #header>更新 OpenList</template>
    <div class="flex items-center gap-2">
      <el-autocomplete
        v-model="selectedVersion"
        :fetch-suggestions="fetchSuggestions"
        placeholder="输入版本号或留空安装 latest"
        clearable
        style="width: 140px; flex-shrink: 0"
      />
      <el-input
        v-model="mirrorUrl"
        placeholder="镜像地址，留空默认 https://ghproxy.net/"
        style="flex: 1; min-width: 0"
      />
      <el-button type="primary" :loading="updating" @click="handleUpdate" style="flex-shrink: 0">
        {{ selectedVersion ? `安装 ${selectedVersion}` : "安装 latest" }}
      </el-button>
    </div>
    <div v-if="updating" class="mt-4">
      <el-progress
        :percentage="progressPercent"
        :stroke-width="18"
        :text-inside="true"
        :status="progressStatus"
      />
      <div class="mt-2 text-xs text-center text-[#909399]">
        {{ progressStepText }}
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: "updated"): void;
}>();

const selectedVersion = ref("latest");
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

async function fetchVersions() {
  try {
    const params = mirrorUrl.value ? { mirror: mirrorUrl.value } : {};
    const res = await $fetch("/api/openlist/versions", { query: params });
    availableVersions.value = (res as any).versions || [];
  } catch {
    // ignore
  }
}

function fetchSuggestions(query: string, cb: (items: { value: string }[]) => void) {
  const suggestions = availableVersions.value.filter((v) =>
    !query || v.toLowerCase().includes(query.toLowerCase())
  );
  const items = suggestions.length > 0
    ? suggestions.map((v) => ({ value: v }))
    : [{ value: "latest" }];
  cb(items);
}

watch(mirrorUrl, () => {
  fetchVersions();
});

async function handleUpdate() {
  updating.value = true;
  progressPercent.value = 0;
  progressStep.value = "";

  const version = selectedVersion.value && selectedVersion.value !== "latest"
    ? selectedVersion.value
    : undefined;

  try {
    const response = await fetch("/api/openlist/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mirror: mirrorUrl.value || undefined, version }),
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
          ElMessage.success(`安装成功，当前版本: ${data.version}`);
          emit("updated");
        } else if (data.event === "error") {
          progressStep.value = "error";
          ElMessage.error(data.message || "安装失败");
        } else if (data.step) {
          progressStep.value = data.step;
          progressPercent.value = data.percent ?? 0;
        }
      }
    }
  } catch (e: any) {
    progressStep.value = "error";
    ElMessage.error(e?.message || "安装失败");
  } finally {
    updating.value = false;
  }
}

onMounted(() => {
  fetchVersions();
});
</script>
