<!--
  访问控制页。

  对应脚本里的「强制登入」与「115 回收站密码」。
  开关用开关控件而不是让用户手写配置文件，避免出现
  「密码填了但开关没开」这类只有读脚本才能理解的组合问题。
-->
<template>
  <div class="access">
    <GlassPanel
      title="强制登录"
      description="开启后访问需要密码，用户名固定 dav。公网暴露必须开。"
    >
      <ElForm label-width="140px" label-position="left">
        <ElFormItem label="强制登录">
          <ElSwitch v-model="switches.forceLogin" @change="saveSwitch('forceLogin')" />

        </ElFormItem>

        <ElFormItem label="访问密码">
          <ElInput
            v-model="password"
            type="password"
            show-password
            clearable
            placeholder="留空表示不修改当前密码"
            style="max-width: 360px"
          />
          <ElButton
            type="primary"
            :loading="saving"
            style="margin-left: 12px"
            @click="savePassword"
          >
            保存密码
          </ElButton>
        </ElFormItem>

        <ElFormItem label="当前状态">
          <span v-if="config.secrets.guestPassword?.configured" class="access__masked">
            {{ config.secrets.guestPassword.masked }}
          </span>
          <ElTag v-else type="info" size="small">未设置密码</ElTag>
        </ElFormItem>
      </ElForm>
    </GlassPanel>

    <GlassPanel
      title="115 回收站密码"
      description="115 Cleaner 清理回收站时使用，与网盘登录密码不同。"
    >
      <ElForm label-width="140px" label-position="left">
        <ElFormItem label="回收站密码">
          <ElInput
            v-model="recyclePassword"
            type="password"
            show-password
            clearable
            placeholder="留空表示不修改"
            style="max-width: 360px"
          />
          <ElButton
            type="primary"
            :loading="savingRecycle"
            style="margin-left: 12px"
            @click="saveRecycle"
          >
            保存
          </ElButton>
        </ElFormItem>
        <ElFormItem label="当前状态">
          <span v-if="config.secrets.recyclePassword?.configured" class="access__masked">
            {{ config.secrets.recyclePassword.masked }}
          </span>
          <ElTag v-else type="info" size="small">未设置</ElTag>
        </ElFormItem>
      </ElForm>
    </GlassPanel>

    <GlassPanel
      title="链接签名"
      description="关闭签名后拿到直链就能下载，公网不建议关。"
    >
      <ElForm label-width="140px" label-position="left">
        <ElFormItem label="关闭签名">
          <ElSwitch v-model="switches.noSign" @change="saveSwitch('noSign')" />

        </ElFormItem>
        <ElFormItem label="阿里转存 115">
          <ElSwitch v-model="switches.ali2115" @change="saveSwitch('ali2115')" />
          <span class="access__hint">需先在网盘授权页配好转存目录 ID。</span>
        </ElFormItem>
      </ElForm>
    </GlassPanel>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import { fetchConfig, saveConfig, type ConfigState } from '@/api/xiaoya'

  defineOptions({ name: 'AccountAccess' })

  const config = ref<ConfigState>({ values: {}, secrets: {}, switches: {} })
  const switches = reactive({ forceLogin: false, noSign: false, ali2115: false })
  const password = ref('')
  const recyclePassword = ref('')
  const saving = ref(false)
  const savingRecycle = ref(false)

  async function load() {
    const res = await fetchConfig()
    config.value = res.data
    switches.forceLogin = res.data.switches.forceLogin ?? false
    switches.noSign = res.data.switches.noSign ?? false
    switches.ali2115 = res.data.switches.ali2115 ?? false
  }

  /** 开关即时生效：开关状态本身就是文件存在与否，保存即改变行为。 */
  async function saveSwitch(key: 'forceLogin' | 'noSign' | 'ali2115') {
    try {
      await saveConfig({ switches: { [key]: switches[key] } })
      ElMessage.success('已保存')
    } catch {
      // 保存失败时回滚界面状态，避免显示成功但实际未生效
      switches[key] = !switches[key]
    }
  }

  async function savePassword() {
    if (password.value === '') {
      ElMessage.warning('请输入新密码')
      return
    }
    saving.value = true
    try {
      await saveConfig({ values: { guestPassword: password.value } })
      ElMessage.success('访问密码已保存')
      password.value = ''
      await load()
    } finally {
      saving.value = false
    }
  }

  async function saveRecycle() {
    if (recyclePassword.value === '') {
      ElMessage.warning('请输入回收站密码')
      return
    }
    savingRecycle.value = true
    try {
      await saveConfig({ values: { recyclePassword: recyclePassword.value } })
      ElMessage.success('回收站密码已保存')
      recyclePassword.value = ''
      await load()
    } finally {
      savingRecycle.value = false
    }
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .access {
    // 卡片间统一 20px 间距：由容器控制，不依赖 GlassPanel 的相邻兄弟选择器
    display: flex;
    flex-direction: column;
    gap: 20px;

    &__hint {
      margin-left: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__masked {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
  }
</style>
