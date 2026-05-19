<template>
  <el-card>
    <template #header>系统状态</template>
    <el-descriptions :column="isMobile ? 1 : 2" border>
      <el-descriptions-item label="版本">{{ status.version }}</el-descriptions-item>
      <el-descriptions-item label="运行状态">
        <el-tag :type="status.running ? 'success' : 'danger'">
          {{ status.running ? "运行中" : "未运行" }}
        </el-tag>
      </el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  status: { version: string; running: boolean };
}>();

const isMobile = useMediaQuery("(max-width: 767px)");
</script>
