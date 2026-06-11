<template>
  <el-card>
    <template #header>
      <span
        ><span class="card-icon password"
          ><el-icon><Lock /></el-icon></span
        >密码管理</span
      >
    </template>
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <el-input
          v-model="customPassword"
          placeholder="自定义密码"
          clearable
          style="flex: 1; min-width: 0"
        />
        <el-button
          :size="btnSize"
          type="warning"
          @click="handleSetPassword"
          :loading="setting"
          :disabled="!customPassword.trim()"
        >
          设置
        </el-button>
      </div>
      <el-button
        :size="btnSize"
        type="warning"
        @click="handleRandomPassword"
        :loading="generating"
      >
        随机生成
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
          <el-button type="warning" link size="small" @click="copyPassword"
            >复制</el-button
          >
        </div>
      </template>
    </el-alert>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Lock } from "@element-plus/icons-vue";
import { useWindowSize } from "@vueuse/core";
import { ElMessage, ElMessageBox } from "element-plus";
import { apiFetch } from "../composables/api";

const setting = ref(false);
const generating = ref(false);
const customPassword = ref("");
const displayPassword = ref("");

const { width } = useWindowSize();
const btnSize = computed(() =>
  width.value >= 768 ? "default" : ("small" as const),
);

async function handleRandomPassword() {
  try {
    await ElMessageBox.confirm(
      "将为管理员账号生成一个新的随机密码，生成后您可以选择是否使用该密码。是否继续？",
      "生成随机密码",
      {
        confirmButtonText: "生成密码",
        cancelButtonText: "取消",
        type: "info",
      },
    );

    generating.value = true;
    const res = await apiFetch("password", {
      method: "POST",
      body: { action: "random" },
    });
    const pwd = (res as any).password;

    await ElMessageBox.confirm(
      `生成的新密码：<strong style="color: #409eff; font-size: 16px;">${pwd}</strong><br/><br/>是否确认使用此密码？`,
      "确认使用随机密码",
      {
        confirmButtonText: "确认使用",
        cancelButtonText: "取消",
        type: "warning",
        dangerouslyUseHTMLString: true,
      },
    );

    setting.value = true;
    await apiFetch("password", {
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
    setting.value = false;
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
    await apiFetch("password", {
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
