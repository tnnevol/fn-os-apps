<!--
  元数据任务页。

  脚本时代任务是在前台跑的：终端一关或 Ctrl+C，进度和错误全部丢失。
  这里把任务状态、阶段、速度与日志摊开，并且刷新页面不会中断任务。
-->
<template>
  <div class="tasks">
    <GlassPanel title="任务列表" description="同一时间只运行一个任务，刷新页面不影响执行">
      <template #header>
        <ElButton size="small" :loading="loading" @click="load">刷新</ElButton>
      </template>

      <ElEmpty v-if="!loading && tasks.length === 0" description="还没有任务记录" />

      <ElTable v-else :data="tasks" size="small" row-key="id" @row-click="openDetail">
        <ElTableColumn prop="label" label="元数据包" min-width="130" />
        <ElTableColumn label="类型" width="110">
          <template #default="{ row }">{{ typeLabel(row.type) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="120">
          <template #default="{ row }">
            <ElTag :type="tagType(row.status)" effect="light" size="small">{{
              statusLabel(row.status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="进度" min-width="180">
          <template #default="{ row }">
            <ElProgress
              :percentage="row.progress"
              :status="
                row.status === 'failed'
                  ? 'exception'
                  : row.status === 'succeeded'
                    ? 'success'
                    : undefined
              "
              :stroke-width="8"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="阶段" min-width="150">
          <template #default="{ row }">{{ row.message }}</template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <ElButton
              v-if="row.status === 'running' || row.status === 'pending'"
              size="small"
              type="danger"
              plain
              @click.stop="cancel(row)"
            >
              取消
            </ElButton>
            <ElButton size="small" @click.stop="openDetail(row)">日志</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </GlassPanel>

    <ElDrawer
      v-model="drawer"
      :title="detail ? `任务日志 — ${detail.label}` : '任务日志'"
      size="560px"
      :append-to-body="true"
    >
      <template v-if="detail">
        <ElDescriptions :column="1" size="small" border>
          <ElDescriptionsItem label="状态">
            <ElTag :type="tagType(detail.status)" effect="light" size="small">{{
              statusLabel(detail.status)
            }}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="阶段">{{ detail.stage }}</ElDescriptionsItem>
          <ElDescriptionsItem label="进度">{{ detail.progress }}%</ElDescriptionsItem>
          <ElDescriptionsItem v-if="detail.totalBytes > 0" label="已传输">
            {{ formatBytes(detail.downloadedBytes) }} / {{ formatBytes(detail.totalBytes) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="detail.speed > 0" label="速度">
            {{ formatBytes(detail.speed) }}/s
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="detail.dirs.length > 0" label="目录">
            {{ detail.dirs.join('、') }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <pre class="tasks__logs">{{ logText }}</pre>
      </template>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import { cancelTask, fetchTask, fetchTasks, type MetadataTask } from '@/api/xiaoya'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'

  defineOptions({ name: 'MetadataTasks' })

  const tasks = ref<MetadataTask[]>([])
  const drawer = ref(false)
  const detail = ref<MetadataTask | null>(null)
  /** 是否已经加载过：用于区分「首次加载中」与「后台静默刷新」 */
  const loaded = ref(false)

  const logText = computed(() => (detail.value?.logs ?? []).join('\n') || '（暂无日志）')

  const TYPE_LABELS: Record<string, string> = {
    download: '下载',
    extract: '解压',
    download_extract: '下载并解压',
    selective_extract: '指定目录解压',
    cleanup: '清理'
  }

  const STATUS_LABELS: Record<string, string> = {
    pending: '排队中',
    running: '运行中',
    succeeded: '已完成',
    failed: '失败',
    cancelled: '已取消',
    interrupted: '已中断'
  }

  function typeLabel(type: string) {
    return TYPE_LABELS[type] ?? type
  }

  function statusLabel(status: string) {
    return STATUS_LABELS[status] ?? status
  }

  function tagType(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
    if (status === 'succeeded') return 'success'
    if (status === 'running' || status === 'pending') return 'primary'
    if (status === 'failed') return 'danger'
    if (status === 'interrupted') return 'warning'
    return 'info'
  }

  function formatTime(value: number): string {
    if (!value) return '—'
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  }

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

  /**
   * 拉取任务列表。
   *
   * 刻意不在这里管理 loading：定时刷新与手动刷新共用本函数，
   * 若置 loading 会让空状态与列表来回切换（视觉抖动）。
   */
  async function load() {
    const res = await fetchTasks()
    tasks.value = res.data.tasks
    // 详情抽屉打开时同步刷新，避免看到过期进度
    if (detail.value !== null) await refreshDetail(detail.value.id)
    loaded.value = true
  }

  const auto = useAutoRefresh({ storageKey: 'fn-xiaoya:tasks-refresh', run: load })
  // 解构到顶层：ref 挂在普通对象上时，模板不会自动解包（v-model 会失效）
  const refreshInterval = auto.interval
  const manualLoading = auto.manualLoading
  const refreshOptions = auto.options
  const doRefresh = auto.refresh

  async function refreshDetail(id: string) {
    const res = await fetchTask(id)
    detail.value = res.data
  }

  async function openDetail(row: MetadataTask) {
    await refreshDetail(row.id)
    drawer.value = true
  }

  async function cancel(row: MetadataTask) {
    await cancelTask(row.id)
    ElMessage.success('已请求取消')
    await load()
  }

  onMounted(() => {
    // start 内部先拉一次再启动定时器
    void auto.start()
  })

  // onUnmounted 的时间清理由 composable 负责
</script>

<style lang="scss" scoped>
  .tasks {
    // 卡片间统一 20px 间距：由容器控制，不依赖 GlassPanel 的相邻兄弟选择器
    display: flex;
    flex-direction: column;
    gap: 20px;

    &__logs {
      max-height: 46vh;
      padding: 12px;
      margin-top: 16px;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.7;
      color: #e2e8f0;
      word-break: break-all;
      white-space: pre-wrap;
      background: rgb(15 23 42 / 88%);
      border-radius: 10px;
    }
  }
</style>
