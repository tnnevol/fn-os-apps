<!--
  概览页。

  回答四个问题：小雅在不在跑、账号配好没有、有没有任务在跑、磁盘够不够。
  这四件事恰好是脚本时代每次都要回终端重新跑一遍菜单才能确认的信息。
-->
<template>
  <div class="console">
    <!-- 运行环境提示：Docker 不可用时后续所有操作都会失败，必须先说清楚 -->
    <ElAlert
      v-if="health && !health.docker.available"
      type="error"
      show-icon
      :closable="false"
      title="Docker 服务不可用"
      :description="`${health.docker.reason || '未知原因'}。小雅容器需要 Docker，请先在飞牛中启动 Docker 服务。`"
      class="console__alert"
    />

    <ElAlert
      v-if="health && !health.configured"
      type="warning"
      show-icon
      :closable="false"
      title="尚未完成账号授权"
      description="小雅需要阿里云盘令牌才能工作。请到「账号配置 → 网盘授权」完成扫码或粘贴令牌。"
      class="console__alert"
    />

    <ElRow :gutter="20">
      <ElCol :xs="24" :sm="12" :lg="6">
        <GlassPanel title="小雅服务">
          <div class="metric">
            <span class="metric__value">{{ alistRunning ? '运行中' : '已停止' }}</span>
            <ElTag :type="alistRunning ? 'success' : 'info'" effect="light" size="small">
              {{ alist?.statusText || '未创建' }}
            </ElTag>
          </div>
          <p class="metric__hint">镜像 {{ alist?.image || alistImage || '—' }}</p>
          <!--
            概览页只做「看得见 + 跳得过去」：启停、更新这类操作会改变
            容器状态，需要看到日志和即时反馈，放在这里容易误点，
            也无法展示启动失败的原因。统一到「小雅服务」页操作。
          -->
          <ElButton size="small" @click="go('/service/alist')">
            {{ alistRunning ? '查看服务' : '去启动' }}
          </ElButton>
        </GlassPanel>
      </ElCol>

      <ElCol :xs="24" :sm="12" :lg="6">
        <GlassPanel title="账号授权">
          <div class="metric">
            <span class="metric__value">{{ health?.configured ? '已配置' : '未配置' }}</span>
            <ElTag :type="health?.configured ? 'success' : 'warning'" effect="light" size="small">
              {{ configuredCount }} 项
            </ElTag>
          </div>
          <p class="metric__hint">阿里云盘令牌与网盘 Cookie</p>
          <ElButton size="small" @click="go('/account/pan')">去配置</ElButton>
        </GlassPanel>
      </ElCol>

      <ElCol :xs="24" :sm="12" :lg="6">
        <GlassPanel title="元数据任务">
          <div class="metric">
            <span class="metric__value">{{
              runningTask ? `${runningTask.progress}%` : '空闲'
            }}</span>
            <ElTag v-if="runningTask" type="primary" effect="light" size="small">
              {{ runningTask.label }}
            </ElTag>
          </div>
          <p class="metric__hint">{{
            runningTask ? runningTask.message : '当前没有运行中的任务'
          }}</p>
          <ElButton size="small" @click="go('/metadata/tasks')">查看任务</ElButton>
        </GlassPanel>
      </ElCol>

      <ElCol :xs="24" :sm="12" :lg="6">
        <GlassPanel title="存储空间">
          <div class="metric">
            <span class="metric__value">{{
              capacity?.free !== undefined ? formatBytes(capacity.free) : '—'
            }}</span>
            <ElTag
              v-if="capacity?.free !== undefined && capacity.recommendedFreeBytes"
              :type="capacity.free >= capacity.recommendedFreeBytes ? 'success' : 'warning'"
              effect="light"
              size="small"
            >
              可用
            </ElTag>
          </div>
          <p class="metric__hint"
            >总容量 {{ capacity?.total !== undefined ? formatBytes(capacity.total) : '—' }}</p
          >
          <ElButton size="small" @click="refreshAll">刷新</ElButton>
        </GlassPanel>
      </ElCol>
    </ElRow>

    <GlassPanel
      title="元数据包"
      description="本地已下载与已解压状态，进入「元数据」页可执行下载与解压"
    >
      <ElTable :data="packages" size="small" :show-overflow-tooltip="true">
        <ElTableColumn prop="label" label="元数据包" min-width="140" />
        <ElTableColumn prop="name" label="文件" min-width="130" />
        <ElTableColumn label="本地大小" min-width="110">
          <template #default="{ row }">{{
            row.size > 0 ? formatBytes(row.size) : '未下载'
          }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" min-width="120">
          <template #default="{ row }">
            <ElTag v-if="row.incomplete" type="warning" effect="light" size="small"
              >下载不完整</ElTag
            >
            <ElTag v-else-if="row.extracted" type="success" effect="light" size="small"
              >已解压</ElTag
            >
            <ElTag v-else-if="row.downloaded" type="primary" effect="light" size="small"
              >已下载</ElTag
            >
            <ElTag v-else type="info" effect="light" size="small">未下载</ElTag>
          </template>
        </ElTableColumn>
      </ElTable>
    </GlassPanel>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import {
    fetchAlistImage,
    fetchAlistStatus,
    fetchCapacity,
    fetchConfig,
    fetchHealth,
    fetchPackages,
    fetchTasks,
    type AlistStatus,
    type CapacityInfo,
    type HealthInfo,
    type MetadataPackage,
    type MetadataTask
  } from '@/api/xiaoya'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'

  defineOptions({ name: 'Console' })

  const router = useRouter()
  const health = ref<HealthInfo | null>(null)
  const alist = ref<AlistStatus | null>(null)
  const alistImage = ref('')
  const packages = ref<MetadataPackage[]>([])
  const capacity = ref<CapacityInfo | null>(null)
  const tasks = ref<MetadataTask[]>([])

  const alistRunning = ref(false)
  const runningTask = ref<MetadataTask | null>(null)
  const configuredCount = ref(0)
  /** 整页数据都拿不到时的提示；单块失败不覆盖上一次的显示值 */
  const loadError = ref('')

  function go(path: string) {
    void router.push(path)
  }

  /** 与服务端返回的容量单位保持一致（字节）。 */
  function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024
      unit += 1
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
  }

  async function refreshAll() {
    // 用 allSettled 而不是 all：这些请求彼此独立，任一接口失败都不应该让整页白屏。
    // 之前用 Promise.all 时，只要 Docker 未就绪或某个接口 500，
    // 就会抛出未捕获的 HttpError，概览页直接停在半渲染状态。
    const settled = await Promise.allSettled([
      fetchHealth(),
      fetchAlistStatus(),
      fetchPackages(),
      fetchCapacity(),
      fetchTasks(),
      fetchAlistImage(),
      fetchConfig()
    ])
    const value = <T,>(index: number): T | undefined => {
      const item = settled[index]
      return item.status === 'fulfilled' ? (item.value as unknown as T) : undefined
    }

    const healthRes = value<{ data: HealthInfo }>(0)
    const statusRes = value<{ data: AlistStatus }>(1)
    const packageRes = value<{ data: { packages: MetadataPackage[] } }>(2)
    const capacityRes = value<{ data: CapacityInfo }>(3)
    const taskRes = value<{ data: { tasks: MetadataTask[] } }>(4)
    const imageRes = value<{ data: { image: string } }>(5)
    const configRes = value<{ data: { secrets: Record<string, { configured: boolean }> } }>(6)

    // 每个区块只在拿到数据时更新，失败的区块保留上一次的显示值
    if (healthRes) health.value = healthRes.data
    if (statusRes) {
      alist.value = statusRes.data
      alistRunning.value = statusRes.data.running
    }
    if (packageRes) packages.value = packageRes.data.packages
    if (capacityRes) capacity.value = capacityRes.data
    if (imageRes) alistImage.value = imageRes.data.image
    if (taskRes) {
      tasks.value = taskRes.data.tasks
      runningTask.value =
        taskRes.data.tasks.find((t) => t.status === 'running' || t.status === 'pending') ?? null
    }
    if (configRes) {
      configuredCount.value = Object.values(configRes.data.secrets).filter(
        (s) => s.configured
      ).length
    }

    // 只提示一次整体失败，而不是每张卡片各报一次错
    const failed = settled.filter((s) => s.status === 'rejected').length
    if (failed > 0 && failed === settled.length) {
      loadError.value = '无法加载面板数据，请检查应用是否正常运行'
    } else {
      loadError.value = ''
    }
  }

  // 任务与容器状态会变化，用可配置的自动刷新代替写死的 10 秒
  const auto = useAutoRefresh({
    storageKey: 'fn-xiaoya:console-refresh',
    run: refreshAll,
    defaultInterval: 10_000
  })
  const refreshInterval = auto.interval
  const manualLoading = auto.manualLoading
  const refreshOptions = auto.options
  const doRefresh = auto.refresh

  onMounted(() => {
    // 首次加载用 start（会显示 loading），之后由定时器静默刷新
    void auto.start()
  })
</script>

<style lang="scss" scoped>
  .console {
    // 本页是混合布局：上方四张指标卡在 ElRow 网格里横向排列，
    // 下方元数据包是通栏卡片。不能用统一的 column+gap（会把网格压成一列），
    // 改为给顶层块加间距，网格内部的间距由 ElRow 的 gutter 控制。
    display: flex;
    flex-direction: column;
    gap: 20px;

    // 网格内的列在窄屏会换行（sm/md 断点），列之间需要纵向间距。
    // ElRow 的 gutter 只解决横向间隔，换行后行与行会贴在一起，
    // 所以给每列加下边距——最后一行的多余边距由 row 的负边距惯例抵消。
    & .el-col {
      margin-bottom: 20px;
    }

    & .el-row {
      // 抵消最后一行多出来的 20px，避免与下一张通栏卡片叠加成 40px
      margin-bottom: -20px;
    }

    &__alert {
      margin-bottom: 16px;
      border-radius: 12px;
    }
  }

  .metric {
    display: flex;
    gap: 8px;
    align-items: baseline;

    &__value {
      font-size: 22px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    &__hint {
      margin: 6px 0 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
