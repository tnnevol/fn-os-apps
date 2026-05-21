<template>
  <el-card>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full" :class="connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'" />
          <span>运行日志</span>
          <span v-if="allLines.length" class="text-xs text-gray-400">{{ allLines.length }} 行</span>
        </div>
        <div class="flex items-center gap-2">
          <el-button size="small" :type="connected ? 'danger' : 'primary'" @click="handleToggle">
            {{ connected ? "停止" : "开始" }}
          </el-button>
          <el-button size="small" type="info" @click="fullscreen = true">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          </el-button>
        </div>
      </div>
    </template>
    <div class="flex items-center gap-2 mt-2!">
      <el-input
        v-model="searchText"
        placeholder="搜索日志..."
        size="small"
        clearable
        prefix-icon="Search"
        class="flex-1"
      >
        <template #suffix>
          <span v-if="searchText" class="text-xs text-gray-400">{{ filteredLines.length }} / {{ allLines.length }}</span>
        </template>
      </el-input>
    </div>
    <LogViewer
      ref="logViewerRef"
      class="mt-2!"
      :filtered-lines="filteredLines"
      :search-text="searchText"
      :highlight-match="highlightMatch"
      :has-data="allLines.length > 0"
      @scroll="onScroll"
    />
  </el-card>

  <el-dialog
    v-model="fullscreen"
    title="运行日志"
    fullscreen
    :close-on-click-modal="false"
    destroy-on-close
    class="log-fullcreen-dialog"
  >
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 mb-3">
        <span class="inline-block w-2 h-2 rounded-full" :class="connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'" />
        <span v-if="allLines.length" class="text-xs text-gray-400">{{ allLines.length }} 行</span>
        <div class="flex-1" />
        <el-button size="small" :type="connected ? 'danger' : 'primary'" @click="handleToggle">
          {{ connected ? "停止" : "开始" }}
        </el-button>
      </div>
      <div class="flex items-center gap-2 mb-3">
        <el-input
          v-model="searchText"
          placeholder="搜索日志..."
          size="default"
          clearable
          prefix-icon="Search"
          class="flex-1"
        >
          <template #suffix>
            <span v-if="searchText" class="text-xs text-gray-400">{{ filteredLines.length }} / {{ allLines.length }}</span>
          </template>
        </el-input>
      </div>
      <LogViewer
        ref="logViewerRefFull"
        :filtered-lines="filteredLines"
        :search-text="searchText"
        :highlight-match="highlightMatch"
        :has-data="allLines.length > 0"
        height-class="flex-1 min-h-0"
        @scroll="onScrollFull"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
const connected = ref(false);
const isAtBottom = ref(true);
const isAtBottomFull = ref(true);
const searchText = ref("");
const fullscreen = ref(false);
const allLines = ref<string[]>([]);
let eventSource: EventSource | null = null;
const MAX_LINES = 500;
const logViewerRef = ref();
const logViewerRefFull = ref();

const displayLines = computed(() => allLines.value.slice(-MAX_LINES));

const filteredLines = computed(() => {
  const lines = displayLines.value;
  const keyword = searchText.value.trim();
  if (!keyword) {
    return lines.map((line, index) => ({ originalIndex: index, line }));
  }
  const lower = keyword.toLowerCase();
  const startIdx = allLines.value.length - lines.length;
  return lines
    .map((line, i) => ({ originalIndex: startIdx + i, line }))
    .filter(item => item.line.toLowerCase().includes(lower));
});

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightMatch(line: string): string {
  const keyword = searchText.value.trim();
  if (!keyword) return escapeHtml(line);
  const escaped = escapeHtml(line);
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escaped.replace(regex, '<mark class="bg-yellow-500/50 text-white px-0.5 rounded">$1</mark>');
}

function onScroll(payload: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  isAtBottom.value = payload.scrollTop + payload.clientHeight >= payload.scrollHeight - 10;
}

function onScrollFull(payload: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  isAtBottomFull.value = payload.scrollTop + payload.clientHeight >= payload.scrollHeight - 10;
}

function scrollToBottom() {
  if (isAtBottom.value && logViewerRef.value) {
    requestAnimationFrame(() => {
      logViewerRef.value?.scrollToBottom();
    });
  }
}

function scrollToBottomFull() {
  if (isAtBottomFull.value && logViewerRefFull.value) {
    requestAnimationFrame(() => {
      logViewerRefFull.value?.scrollToBottom();
    });
  }
}

function handleToggle() {
  if (connected.value) {
    disconnect();
  } else {
    connect();
  }
}

function connect() {
  allLines.value = [];
  eventSource = new EventSource("/api/openlist/logs");

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.lines) {
        allLines.value = data.lines.slice(-MAX_LINES);
        scrollToBottom();
        scrollToBottomFull();
      } else if (data.line) {
        allLines.value.push(data.line);
        if (allLines.value.length > MAX_LINES) {
          allLines.value = allLines.value.slice(-MAX_LINES);
        }
        scrollToBottom();
        scrollToBottomFull();
      }
    } catch {
      // ignore malformed JSON
    }
  };

  eventSource.onerror = () => {
    disconnect();
  };

  connected.value = true;
}

function disconnect() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  connected.value = false;
}

onUnmounted(() => {
  disconnect();
});
</script>

<style>
.log-fullcreen-dialog.el-dialog {
  margin: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
}
.log-fullcreen-dialog.el-dialog.is-fullscreen {
  margin: 0 !important;
}
.log-fullcreen-dialog .el-dialog__header {
  padding: 12px 16px !important;
  margin: 0 !important;
  border-bottom: 1px solid var(--el-border-color-light);
}
.log-fullcreen-dialog .el-dialog__body {
  display: flex !important;
  flex-direction: column !important;
  padding: 16px !important;
  height: calc(100vh - 60px) !important;
  overflow: hidden !important;
}
</style>
