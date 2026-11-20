<!--
  设置页。

  只放真正会影响行为、且用户可以安全修改的项：
  镜像版本、代理地址、目录信息。
  目录不提供「任意路径输入」——脚本时代用户能填任意路径，
  结果应用既写不进去也删不掉，这里只展示本应用实际使用的目录。
-->
<template>
  <div class="general">
    <GlassPanel title="镜像版本" description="切换镜像后需要重启容器才会生效">
      <ElForm label-width="120px" label-position="left">
        <ElFormItem label="小雅镜像">
          <ElSelect v-model="image" style="max-width: 320px" @change="saveImage">
            <ElOption
              label="xiaoyaliu/alist:latest（bridge 网络，默认）"
              value="xiaoyaliu/alist:latest"
            />
            <ElOption
              label="xiaoyaliu/alist:hostmode（host 网络）"
              value="xiaoyaliu/alist:hostmode"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Emby 端口">
          <ElSwitch v-model="embyPorts" :loading="savingEmby" @change="saveEmbyPorts" />
          <span class="general__hint general__hint--inline">
            打开后额外映射 2345-2347（供 Emby 客户端直连）；不装 Emby 时无需开启。
          </span>
        </ElFormItem>
      </ElForm>
      <ElAlert
        type="warning"
        show-icon
        :closable="false"
        title="host 模式会直接占用宿主端口"
        :description="`host 模式跳过端口映射，若 ${embyPorts ? '5678/2345/2346/2347' : '5678'} 已被占用会启动失败。一般场景保持 latest 即可。`"
      />
    </GlassPanel>

    <GlassPanel title="网络代理" description="小雅访问网盘时可选走代理，留空表示直连">
      <ElForm label-width="120px" label-position="left">
        <ElFormItem label="代理地址">
          <ElInput
            v-model="proxy"
            placeholder="http://192.168.1.2:7890"
            clearable
            style="max-width: 400px"
          />
          <ElButton
            type="primary"
            :loading="savingProxy"
            style="margin-left: 12px"
            @click="saveProxy"
          >
            保存
          </ElButton>
        </ElFormItem>
      </ElForm>
      <p class="general__hint"> 当前状态：{{ config.values.proxy ? '已配置' : '未配置' }} </p>
    </GlassPanel>

    <!--
      元数据目录属于「一次性配置」，放在常规设置比放在元数据包页更合适：
      那里是日常操作页，配置项混在操作里容易被忽略。
    -->
    <GlassPanel
      title="元数据目录"
      description="元数据会写入你在飞牛中授权的目录。未经授权无法选择，也不能写入授权范围之外的路径。"
    >
      <MediaDirPicker />
    </GlassPanel>

    <GlassPanel title="运行信息" description="用于排查问题，这些目录由应用管理">
      <ElDescriptions :column="1" size="small" border>
        <ElDescriptionsItem label="应用版本">{{ health?.version ?? '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="运行模式">
          {{ health?.mode === 'development' ? '开发（直连端口）' : '生产（飞牛网关）' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="当前用户">
          {{ health?.user.username || health?.user.uid || '—' }}
          <ElTag v-if="health?.user.isAdmin" type="success" size="small" style="margin-left: 8px"
            >管理员</ElTag
          >
        </ElDescriptionsItem>
        <ElDescriptionsItem label="Docker">
          <ElTag :type="health?.docker.available ? 'success' : 'danger'" size="small">
            {{
              health?.docker.available
                ? `可用（${health.docker.version}）`
                : health?.docker.reason || '不可用'
            }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="配置目录">{{ paths?.configDir ?? '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="媒体目录">{{ paths?.mediaRoot ?? '—' }}</ElDescriptionsItem>
      </ElDescriptions>
    </GlassPanel>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import { loadAll } from '@/utils/loadAll'
  import MediaDirPicker from '@/components/media/MediaDirPicker.vue'
  import {
    fetchAlistImage,
    fetchConfig,
    fetchHealth,
    saveAlistImage,
    saveConfig,
    type ConfigState,
    type HealthInfo
  } from '@/api/xiaoya'
  import request from '@/utils/http'

  defineOptions({ name: 'SettingsGeneral' })

  interface PathsEnvelope {
    code: number
    data: { configDir: string; mediaRoot: string; pkgVar: string }
  }

  const image = ref('xiaoyaliu/alist:latest')
  /** 是否暴露 Emby 端口（2345-2347） */
  const embyPorts = ref(false)
  const savingEmby = ref(false)
  const proxy = ref('')
  const savingProxy = ref(false)
  const health = ref<HealthInfo | null>(null)
  const config = ref<ConfigState>({ values: {}, secrets: {}, switches: {} })
  const paths = ref<PathsEnvelope['data'] | null>(null)

  async function load() {
    // 四个接口互相独立；任一失败（例如 Docker 未就绪）不应让整页白屏
    const [imageRes, configRes, healthRes, pathsRes] = await loadAll([
      fetchAlistImage(),
      fetchConfig(),
      fetchHealth(),
      request.get<PathsEnvelope>({ url: '/api/system/paths' })
    ])
    if (imageRes.data) image.value = imageRes.data.data.image
    if (configRes.data) {
      config.value = configRes.data.data
      proxy.value = configRes.data.data.values.proxy ?? ''
    }
    if (healthRes.data) health.value = healthRes.data.data
    if (pathsRes.data) paths.value = pathsRes.data.data
  }

  /** 切换 Emby 端口开关：需要重建 compose，提示用户重启才生效。 */
  async function saveEmbyPorts(value: boolean | string | number) {
    savingEmby.value = true
    try {
      await saveConfig({ switches: { embyPorts: Boolean(value) } })
      ElMessage.success('已保存，重启小雅服务后生效')
    } catch {
      // 失败回滚开关，避免界面与真实配置不一致
      embyPorts.value = !embyPorts.value
    } finally {
      savingEmby.value = false
    }
  }

  async function saveImage() {
    await saveAlistImage(image.value)
    ElMessage.success('镜像已保存，重启容器后生效')
  }

  async function saveProxy() {
    savingProxy.value = true
    try {
      await saveConfig({ values: { proxy: proxy.value.trim() } })
      ElMessage.success(proxy.value.trim() === '' ? '已清除代理' : '代理已保存')
      await load()
    } finally {
      savingProxy.value = false
    }
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .general {
    // 卡片间统一 20px 间距：由容器控制，不依赖 GlassPanel 的相邻兄弟选择器
    display: flex;
    flex-direction: column;
    gap: 20px;

    &__hint {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
