<template>
  <el-card>
    <template #header>密码管理</template>
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <el-input
          v-model="customPassword"
          placeholder="自定义密码"
          clearable
          style="flex: 1; min-width: 0"
        />
        <el-button type="primary" @click="handleSetPassword" :loading="setting" :disabled="!customPassword.trim()">
          设置密码
        </el-button>
      </div>
      <el-button
        type="success"
        @click="handleRandomPassword"
        :loading="generating"
      >
        随机生成密码
      </el-button>
    </div>
    <el-alert
      v-if="displayPassword"
      type="success"
      :closable="false"
      class="mt-2!"
      show-icon
    >
      <template #default>
        <div class="flex items-center gap-2">
          <span
            >新密码: <strong>{{ displayPassword }}</strong></span
          >
          <el-button type="primary" link size="small" @click="copyPassword"
            >复制</el-button
          >
        </div>
      </template>
    </el-alert>
  </el-card>
</template>

<script setup lang="ts">
const setting = ref(false);
const generating = ref(false);
const customPassword = ref("");
const displayPassword = ref("");

async function handleRandomPassword() {
  generating.value = true;
  try {
    const res = await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "random" },
    });
    const pwd = (res as any).password;
    await ElMessageBox.confirm(
      `是否使用随机密码：${pwd}`,
      "确认使用",
      {
        confirmButtonText: "确认使用",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "set", password: pwd },
    });
    displayPassword.value = pwd;
    ElMessage.success("密码已设置");
  } catch (e: any) {
    if (e === "cancel") return;
    ElMessage.error(e?.data?.message || "操作失败");
  } finally {
    generating.value = false;
  }
}

async function handleSetPassword() {
  const pwd = customPassword.value.trim();
  if (!pwd) {
    ElMessage.warning("请输入密码");
    return;
  }
  setting.value = true;
  try {
    await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "set", password: pwd },
    });
    ElMessage.success("密码已设置");
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "设置密码失败");
  } finally {
    setting.value = false;
  }
}

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(displayPassword.value);
    ElMessage.success("已复制到剪贴板");
  } catch {
    ElMessage.error("复制失败");
  }
}
</script>
