<template>
  <el-card>
    <template #header>
      <div class="flex items-center justify-between">
        <span>运行日志</span>
        <el-button size="small" :type="connected ? 'danger' : 'primary'" @click="handleToggle">
          {{ connected ? "停止" : "开始" }}
        </el-button>
      </div>
    </template>
    <div
      ref="logContainer"
      class="bg-[#0a0a0a] text-[#e5e5e5] font-mono text-xs leading-relaxed h-[300px] overflow-y-auto p-3 rounded"
      @scroll="onScroll"
    >
      <div v-for="(l, i) in displayLines" :key="i" class="whitespace-pre-wrap break-all">
        {{ l }}
      </div>
      <div v-if="!displayLines.length" class="text-[#666] text-center py-8">
        暂无日志数据
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
const logContainer = ref<HTMLElement>();
const displayLines = ref<string[]>([]);
const connected = ref(false);
const isAtBottom = ref(true);
let eventSource: EventSource | null = null;
const MAX_LINES = 500;

function onScroll() {
  const el = logContainer.value;
  if (!el) return;
  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
}

function scrollToBottom() {
  if (isAtBottom.value && logContainer.value) {
    requestAnimationFrame(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
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
  displayLines.value = [];
  eventSource = new EventSource("/api/openlist/logs");

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.lines) {
        // Initial batch
        displayLines.value = data.lines.slice(-MAX_LINES);
        scrollToBottom();
      } else if (data.line) {
        displayLines.value.push(data.line);
        if (displayLines.value.length > MAX_LINES) {
          displayLines.value = displayLines.value.slice(-MAX_LINES);
        }
        scrollToBottom();
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
