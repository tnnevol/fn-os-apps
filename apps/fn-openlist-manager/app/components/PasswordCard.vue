<template>
  <el-card>
    <template #header>密码管理</template>
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <el-input v-model="customPassword" placeholder="自定义密码" clearable style="flex: 1; min-width: 0" />
        <el-button type="warning" @click="handleSetPassword" :loading="setting">
          设置密码
        </el-button>
      </div>
      <el-button @click="handleRandomPassword" :loading="generating">
        随机生成密码
      </el-button>
    </div>
    <el-alert v-if="generatedPassword" type="success" :closable="false" class="mt-2" show-icon>
      <template #default>
        <div class="flex items-center gap-2">
          <span>新密码: <strong>{{ generatedPassword }}</strong></span>
          <el-button type="primary" link size="small" @click="copyPassword">复制</el-button>
        </div>
      </template>
    </el-alert>
  </el-card>
</template>

<script setup lang="ts">
const setting = ref(false);
const generating = ref(false);
const customPassword = ref("");
const generatedPassword = ref("");

async function handleRandomPassword() {
  generating.value = true;
  try {
    const res = await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "random" },
    });
    generatedPassword.value = (res as any).password;
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "生成密码失败");
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
    await navigator.clipboard.writeText(generatedPassword.value);
    ElMessage.success("已复制到剪贴板");
  } catch {
    ElMessage.error("复制失败");
  }
}
</script>
