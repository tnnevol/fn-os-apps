<template>
  <div class="log-area">
    <div class="log-header">
      <div class="log-header-title">
        <span class="dot" :class="connected ? 'active' : 'inactive'"></span>
        运行日志
        <span
          v-if="allLines.length"
          class="text-xs"
          style="color: var(--ol-log-muted)"
          >{{ allLines.length }} 行</span
        >
      </div>
      <div class="log-search">
        <el-input
          v-model="searchText"
          placeholder="搜索..."
          clearable
          :size="controlSize"
          style="width: 150px"
        >
          <template #prefix
            ><el-icon><Search /></el-icon
          ></template>
          <template #suffix>
            <span
              v-if="searchText"
              class="text-xs"
              style="color: var(--ol-log-muted)"
              >{{ filteredLines.length }}/{{ allLines.length }}</span
            >
          </template>
        </el-input>
        <el-button
          class="log-icon-btn"
          :type="connected ? 'danger' : 'primary'"
          :size="controlSize"
          @click="handleToggle"
        >
          <el-icon
            ><component :is="connected ? VideoPause : VideoPlay"
          /></el-icon>
        </el-button>
        <el-button
          class="log-icon-btn log-fullscreen-btn"
          type="success"
          :size="controlSize"
          @click="fullscreen = true"
        >
          <el-icon><FullScreen /></el-icon>
        </el-button>
      </div>
    </div>
    <div ref="logBodyRef" class="log-body">
      <template v-if="displayLines.length">
        <div
          v-for="item in filteredLines"
          :key="item.originalIndex"
          class="log-line"
        >
          <span class="log-num">{{ item.originalIndex + 1 }}</span>
          <span
            class="log-text"
            v-if="searchText"
            v-html="highlightMatch(item.line)"
          />
          <span class="log-text" v-else v-html="ansiToHtml(item.line)" />
        </div>
      </template>
      <div v-else-if="allLines.length" class="log-empty">无匹配结果</div>
      <div v-else class="log-empty">暂无日志，点击「开始」连接</div>
    </div>
  </div>

  <el-dialog
    v-model="fullscreen"
    title="运行日志"
    :append-to-body="true"
    :close-on-click-modal="false"
    destroy-on-close
    fullscreen
    class="log-fullscreen-dialog"
  >
    <template #header="{ close, titleId, titleClass }">
      <div class="log-fullscreen-header">
        <div class="log-fullscreen-header-left">
          <span :id="titleId" :class="titleClass">运行日志</span>
          <span
            class="dot log-fullscreen-dot"
            :class="connected ? 'active' : 'inactive'"
          ></span>
          <span v-if="allLines.length" class="log-fullscreen-line-count"
            >{{ allLines.length }} 行</span
          >
        </div>
        <el-icon class="log-fullscreen-close-btn" @click="close"
          ><Minus
        /></el-icon>
      </div>
    </template>
    <div class="log-fullscreen-body">
      <div class="log-fullscreen-toolbar">
        <el-input
          v-model="searchText"
          placeholder="搜索..."
          clearable
          class="log-fullscreen-search"
          :size="controlSize"
        >
          <template #prefix
            ><el-icon><Search /></el-icon
          ></template>
          <template #suffix>
            <span
              v-if="searchText"
              class="text-xs"
              style="color: var(--ol-log-muted)"
              >{{ filteredLines.length }}/{{ allLines.length }}</span
            >
          </template>
        </el-input>
        <el-button
          class="log-icon-btn"
          :type="connected ? 'danger' : 'primary'"
          :size="controlSize"
          @click="handleToggle"
        >
          <el-icon
            ><component :is="connected ? VideoPause : VideoPlay"
          /></el-icon>
        </el-button>
      </div>
      <div ref="logBodyFullRef" class="log-fullscreen-content">
        <template v-if="displayLines.length">
          <div
            v-for="item in filteredLines"
            :key="item.originalIndex"
            class="log-line"
          >
            <span class="log-num">{{ item.originalIndex + 1 }}</span>
            <span
              class="log-text"
              v-if="searchText"
              v-html="highlightMatch(item.line)"
            />
            <span class="log-text" v-else v-html="ansiToHtml(item.line)" />
          </div>
        </template>
        <div v-else-if="allLines.length" class="log-empty">无匹配结果</div>
        <div v-else class="log-empty">暂无日志</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  Search,
  VideoPlay,
  VideoPause,
  FullScreen,
  Minus,
} from "@element-plus/icons-vue";
import { useWindowSize } from "@vueuse/core";

const props = defineProps<{
  wsPort?: number;
}>();

const connected = ref(false);
const searchText = ref("");
const fullscreen = ref(false);
const allLines = ref<string[]>([]);
let ws: WebSocket | null = null;
const MAX_LINES = 200;
const logBodyRef = ref<HTMLElement>();
const logBodyFullRef = ref<HTMLElement>();

const autoScroll = ref(true);
const autoScrollFull = ref(true);

const { width } = useWindowSize();
const controlSize = computed(() =>
  width.value >= 768 ? "default" : ("small" as const),
);

// 获取当前主机名
const localIp = useLocalIp();

const displayLines = computed(() => allLines.value.slice(-MAX_LINES));

const filteredLines = computed(() => {
  const lines = displayLines.value;
  const keyword = searchText.value.trim();
  if (!keyword) {
    return lines.map((line, i) => ({ originalIndex: i, line }));
  }
  const lower = keyword.toLowerCase();
  const startIdx = allLines.value.length - lines.length;
  return lines
    .map((line, i) => ({ originalIndex: startIdx + i, line }))
    .filter((item) => item.line.toLowerCase().includes(lower));
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const ANSI_STYLES: Record<string, string> = {
  "36": "color: #56b6c2",
  "33": "color: #e2a855",
  "31": "color: #e8655a",
  "32": "color: #38b586",
  "1;36": "color: #56b6c2; font-weight: 600",
  "1;33": "color: #e2a855; font-weight: 600",
  "1;31": "color: #e8655a; font-weight: 600",
  "1;32": "color: #38b586; font-weight: 600",
};

function ansiToHtml(line: string): string {
  let html = "";
  let currentStyle = "";
  let remaining = escapeHtml(line);

  while (remaining) {
    const match = remaining.match(/\x1b\[(\d+(;\d+)*)m/);
    if (!match || match.index === undefined) {
      html += currentStyle
        ? `<span style="${currentStyle}">${remaining}</span>`
        : remaining;
      break;
    }

    const prefix = remaining.slice(0, match.index);
    if (prefix) {
      html += currentStyle
        ? `<span style="${currentStyle}">${prefix}</span>`
        : prefix;
    }

    const code = match[1];
    if (code && code !== "0" && ANSI_STYLES[code]) {
      currentStyle = ANSI_STYLES[code];
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return html;
}

function highlightMatch(line: string): string {
  let html = ansiToHtml(line);
  const keyword = searchText.value.trim();
  if (!keyword) return html;
  const regex = new RegExp(
    `(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  return html.replace(
    regex,
    '<mark style="background: rgba(234, 179, 8, 0.35); color: #fff; padding: 0 2px; border-radius: 2px">$1</mark>',
  );
}

function scrollToBottom() {
  if (autoScroll.value && logBodyRef.value) {
    requestAnimationFrame(() => {
      logBodyRef.value!.scrollTop = logBodyRef.value!.scrollHeight;
    });
  }
}

function scrollToBottomFull() {
  if (autoScrollFull.value && logBodyFullRef.value) {
    requestAnimationFrame(() => {
      logBodyFullRef.value!.scrollTop = logBodyFullRef.value!.scrollHeight;
    });
  }
}

function onScroll() {
  if (!logBodyRef.value) return;
  const el = logBodyRef.value;
  autoScroll.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
}

function onScrollFull() {
  if (!logBodyFullRef.value) return;
  const el = logBodyFullRef.value;
  autoScrollFull.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
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

  // 使用从接口获取的 WebSocket 端口
  const wsPort = props.wsPort || 3001;
  const wsUrl = `ws://${localIp}:${wsPort}/ws/logs`;

  ws = new WebSocket(wsUrl);

  ws.onmessage = (e) => {
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

  ws.onerror = () => {
    disconnect();
  };

  ws.onclose = () => {
    disconnect();
  };

  connected.value = true;
}

function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
  connected.value = false;
}

onUnmounted(() => {
  disconnect();
});

// Attach scroll listeners after mount
onMounted(() => {
  nextTick(() => {
    logBodyRef.value?.addEventListener("scroll", onScroll);
    logBodyFullRef.value?.addEventListener("scroll", onScrollFull);
  });
});
</script>
