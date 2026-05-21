<template>
  <div
    ref="logContainer"
    class="bg-[#1a1a2e] text-[#c8d6e5] font-mono text-xs leading-relaxed overflow-y-auto p-3 rounded-lg border border-[#2a2a3e] flex flex-col"
    :class="heightClass"
    @scroll="onScroll"
  >
    <template v-if="filteredLines.length">
      <div v-for="item in filteredLines" :key="item.originalIndex" class="flex gap-3 hover:bg-white/5 px-1 py-0.5 rounded whitespace-pre-wrap break-all">
        <span class="text-[#555] select-none shrink-0 w-10 text-right">{{ item.originalIndex + 1 }}</span>
        <span v-if="searchText" class="text-[#e0e0e0]" v-html="highlightMatch(item.line)" />
        <span v-else class="text-[#e0e0e0]" v-text="item.line" />
      </div>
    </template>
    <div v-else-if="hasData" class="flex items-center justify-center h-full text-base text-[#aaa]">
      无匹配结果
    </div>
    <div v-else class="flex items-center justify-center h-full text-lg text-[#aaa]">
      暂无日志数据
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  filteredLines: { originalIndex: number; line: string }[];
  searchText: string;
  highlightMatch: (line: string) => string;
  hasData?: boolean;
  heightClass?: string;
}>(), {
  hasData: true,
  heightClass: "h-[300px]",
});

const emit = defineEmits<{
  scroll: [payload: { scrollTop: number; scrollHeight: number; clientHeight: number }];
}>();

const logContainer = ref<HTMLElement>();

function onScroll() {
  const el = logContainer.value;
  if (!el) return;
  emit("scroll", {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  });
}

function scrollToBottom() {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
}

defineExpose({ scrollToBottom });
</script>
