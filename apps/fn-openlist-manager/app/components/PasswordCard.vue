<template>
  <el-card>
    <template #header>密码管理</template>
    <div class="flex flex-col gap-2">
      <el-button @click="handleRandomPassword" :loading="loading">
        随机生成密码
      </el-button>
      <el-input v-model="customPassword" placeholder="自定义密码" clearable />
      <el-button type="warning" @click="handleSetPassword" :loading="loading">
        设置密码
      </el-button>
    </div>
    <el-alert v-if="randomPassword" type="success" :closable="false" class="mt-2">
      新密码: <strong>{{ randomPassword }}</strong>
    </el-alert>
  </el-card>
</template>

<script setup lang="ts">
const loading = ref(false);
const customPassword = ref("");
const randomPassword = ref("");

async function handleRandomPassword() {
  loading.value = true;
  try {
    const res = await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "random" },
    });
    randomPassword.value = (res as any).password;
    ElMessage.success("密码已随机生成");
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "生成密码失败");
  } finally {
    loading.value = false;
  }
}

async function handleSetPassword() {
  const pwd = customPassword.value;
  if (!pwd) {
    ElMessage.warning("请输入密码");
    return;
  }
  loading.value = true;
  try {
    await $fetch("/api/openlist/password", {
      method: "POST",
      body: { action: "set", password: pwd },
    });
    ElMessage.success("密码已设置");
    customPassword.value = "";
  } catch (e: any) {
    ElMessage.error(e?.data?.message || "设置密码失败");
  } finally {
    loading.value = false;
  }
}
</script>
