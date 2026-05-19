<template>
  <el-header class="flex items-center justify-between bg-white dark:bg-[#1d1e1f] px-4 md:px-6 shadow-sm">
    <div class="flex items-center gap-2">
      <img src="/image.png" alt="Logo" class="h-8 w-8 object-contain" />
      <h1 class="text-base md:text-lg font-semibold m-0 text-[#303133] dark:text-[#e5eaf3]">
        OpenList 管理面板
      </h1>
    </div>
    <el-tooltip :content="isDark ? '切换浅色模式' : '切换暗黑模式'" placement="bottom">
      <el-button circle @click="toggleDark" class="theme-toggle">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          :class="isDark ? 'text-[#e5eaf3]' : 'text-[#606266]'"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle v-if="!isDark" cx="12" cy="12" r="5" />
          <path v-if="!isDark" stroke-linecap="round" stroke-linejoin="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          <path v-if="isDark" stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </el-button>
    </el-tooltip>
  </el-header>
</template>

<script setup lang="ts">
const { isDark, toggleDark } = useDarkMode();
</script>

<style scoped>
.theme-toggle {
  border: none;
  background: transparent;
  padding: 8px;
}
.theme-toggle:hover {
  background: var(--el-fill-color-light);
}
</style>
