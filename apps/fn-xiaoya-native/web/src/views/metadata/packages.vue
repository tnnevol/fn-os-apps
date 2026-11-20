<!--
  元数据包页。

  对应脚本 `main_download_unzip_xiaoya_emby` 的菜单：下载、解压、
  下载并解压、删除压缩包。这些操作原本要用户输入数字编号，
  现在改为每个包一行按钮，按钮可用性直接跟随本地状态。

  两处刻意的简化：
  - 所有元数据包统一解压到用户授权的元数据目录，不提供「指定目录解压」；
  - 未授权目录时禁用全部操作——这些动作都要写入该目录，没有目录就无处落地。

  元数据目录的**选择**在「设置 → 常规设置」，本页只负责在该目录内执行操作；
  顶部会提示未配置并给一个跳转链接，避免用户在本页找不到入口。
-->
<template>
  <div class="packages">
    <!--
      未配置目录时给一条明确指引。
      目录选择已移到「设置 → 常规设置」，这里只做提示与跳转，
      否则用户在本页会找不到入口、只看到操作全被禁用。
    -->
    <ElAlert
      v-if="!mediaReady"
      type="warning"
      show-icon
      :closable="false"
      title="还没有选择元数据目录"
      description="所有元数据包都要解压到这个目录。请先到「设置 → 常规设置」授权一个目录，再回来操作。"
    >
      <template #default>
        <ElButton size="small" type="primary" plain @click="goToSettings"> 去设置目录 </ElButton>
      </template>
    </ElAlert>

    <!-- 目录内的文件操作：新建 / 重命名 / 删除 -->
    <GlassPanel
      v-if="mediaRoot !== ''"
      title="目录管理"
      description="管理元数据目录里的文件夹；下载与解压由下方元数据包按钮触发。"
    >
      <MediaBrowser :key="mediaRoot" :root="mediaRoot" />
    </GlassPanel>

    <GlassPanel
      title="存储状态"
      description="下载前会检查可用空间。元数据体量较大，空间不足时请先清理。"
    >
      <div v-if="capacity && !capacity.unavailable" class="packages__capacity">
        <div class="packages__bar">
          <div class="packages__bar-inner" :style="{ width: usedPercent }"></div>
        </div>
        <p class="packages__capacity-text">
          已用 {{ formatBytes(capacity.used ?? 0) }} / 共 {{ formatBytes(capacity.total ?? 0) }}，
          可用 <strong>{{ formatBytes(capacity.free ?? 0) }}</strong>
        </p>
        <ElAlert
          v-if="lowSpace"
          type="warning"
          show-icon
          :closable="false"
          title="可用空间偏紧"
          :description="spaceAdvice"
        />
      </div>
      <p v-else class="packages__hint">无法读取容量：{{ capacity?.reason ?? '未知原因' }}</p>
    </GlassPanel>

    <GlassPanel title="元数据包" description="同一时间只允许一个任务运行" :flush="false">
      <template #header>
        <div class="packages__controls">
          <span class="packages__label">自动刷新</span>
          <ElSelect v-model="refreshInterval" size="small" class="packages__interval">
            <ElOption
              v-for="opt in refreshOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
          <ElButton size="small" :loading="auto.manualLoading.value" @click="doRefresh()">
            刷新
          </ElButton>
        </div>
      </template>

      <ElTable :data="packages" size="small" row-key="name">
        <ElTableColumn prop="label" label="名称" min-width="150">
          <template #default="{ row }">
            <div class="packages__name">
              <span>{{ row.label }}</span>
              <small>{{ row.name }}</small>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="本地大小" width="110">
          <template #default="{ row }">
            {{ row.size > 0 ? formatBytes(row.size) : '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="120">
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
        <ElTableColumn label="操作" min-width="360">
          <template #default="{ row }">
            <ElButton
              size="small"
              :disabled="busy"
              :loading="submitting === `${row.name}:download`"
              @click="submit(asPackage(row), 'download')"
            >
              下载
            </ElButton>
            <ElButton
              size="small"
              :disabled="busy || !row.downloaded || row.incomplete"
              :loading="submitting === `${row.name}:extract`"
              @click="submit(asPackage(row), 'extract')"
            >
              解压
            </ElButton>
            <ElButton
              size="small"
              type="primary"
              :disabled="busy"
              :loading="submitting === `${row.name}:download_extract`"
              @click="submit(asPackage(row), 'download_extract')"
            >
              下载并解压
            </ElButton>
            <ElButton
              size="small"
              type="danger"
              plain
              :disabled="busy || (!row.downloaded && !row.incomplete)"
              @click="remove(asPackage(row))"
            >
              删除包
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <p class="packages__hint packages__hint--note">
        「删除包」只删除下载的压缩包，已解压的媒体目录不受影响。
      </p>
    </GlassPanel>

  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import MediaBrowser from '@/components/media/MediaBrowser.vue'
  import { loadAll } from '@/utils/loadAll'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import {
    createTask,
    deleteArchive,
    fetchCapacity,
    fetchMediaDir,
    fetchPackages,
    fetchTasks,
    type CapacityInfo,
    type MetadataPackage
  } from '@/api/xiaoya'

  defineOptions({ name: 'MetadataPackages' })

  const router = useRouter()

  const packages = ref<MetadataPackage[]>([])

  /**
   * 插槽行收敛。
   *
   * ElTable 的 #default 插槽把 row 推成 DefaultRow，无法从 :data 反推元素类型；
   * 这里显式断言一次，避免每处模板都写类型守卫。
   */
  function asPackage(row: unknown): MetadataPackage {
    return row as MetadataPackage
  }
  /** 当前生效的元数据目录；为空时不展示文件管理面板 */
  const mediaRoot = ref('')
  const capacity = ref<CapacityInfo | null>(null)
  const busy = ref(false)
  /**
   * 元数据目录是否已授权。
   *
   * 未授权时所有下载/解压/删除操作都必须禁用：这些操作都会写入
   * 用户授权的目录，没有目录就无处落地。后端也会再校验一次。
   */
  const mediaReady = computed(() => mediaRoot.value !== '')
  const submitting = ref('')

  const usedPercent = computed(() => {
    if (!capacity.value?.total) return '0%'
    return `${Math.round(((capacity.value.used ?? 0) / capacity.value.total) * 100)}%`
  })

  const lowSpace = computed(() => {
    const free = capacity.value?.free
    const need = capacity.value?.recommendedFreeBytes
    return free !== undefined && need !== undefined && free < need
  })

  /**
   * 空间提示文案。
   *
   * 不同元数据包体积差距很大（配置包几 G、全量包数百 G），
   * 统一宣称「都要 100G」会误导用户以为小包也下不了。
   * 这里列出当前空间能容纳哪些包，不能容纳的明确说明。
   */
  const spaceAdvice = computed(() => {
    const free = capacity.value?.free
    if (free === undefined) return ''
    // 与后端 PACKAGE_SIZE_HINT 的量级保持一致
    const need: Record<string, number> = {
      'all.mp4': 300 * 1024 ** 3,
      '蓝光原盘.mp4': 200 * 1024 ** 3,
      '115.mp4': 120 * 1024 ** 3,
      'json.mp4': 40 * 1024 ** 3,
      'music.mp4': 40 * 1024 ** 3,
      '短剧.mp4': 20 * 1024 ** 3,
      'config.mp4': 5 * 1024 ** 3
    }
    const fits = packages.value.filter((p) => free >= (need[p.name] ?? 0)).map((p) => p.label)
    const tooBig = packages.value.filter((p) => free < (need[p.name] ?? 0)).map((p) => p.label)
    if (tooBig.length === 0) return `当前可用 ${formatBytes(free)}，所有元数据包都能下载。`
    if (fits.length === 0) return `当前可用 ${formatBytes(free)}，空间不足以下载任何元数据包。`
    return `当前可用 ${formatBytes(free)}，可下载：${fits.join('、')}；空间不足：${tooBig.join('、')}。`
  })

  /** 跳到常规设置去配置元数据目录。 */
  function goToSettings() {
    void router.push('/settings/general')
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

  async function load() {
    // 任务/容量接口失败不应让元数据包列表消失
    const [packageRes, capacityRes, taskRes, dirRes] = await loadAll([
      fetchPackages(),
      fetchCapacity(),
      fetchTasks(),
      fetchMediaDir()
    ])
    if (dirRes.data) mediaRoot.value = dirRes.data.data.path ?? ''
    if (packageRes.data) packages.value = packageRes.data.data.packages
    if (capacityRes.data) capacity.value = capacityRes.data.data
    if (taskRes.data) {
      // 有任务在跑时禁用所有创建按钮，避免用户反复点击拿到 409
      busy.value = taskRes.data.data.tasks.some(
        (t) => t.status === 'running' || t.status === 'pending'
      )
    }
  }

  async function submit(row: MetadataPackage, type: string) {
    // 配置包会覆盖 Emby 配置，属于破坏性操作，必须二次确认
    if (row.target === 'config' && type !== 'download') {
      try {
        await ElMessageBox.confirm(
          '配置包解压会覆盖当前 Emby 配置目录，可能导致用户、播放记录与个性化设置丢失。是否继续？',
          '确认覆盖配置',
          { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
        )
      } catch {
        return
      }
    }
    submitting.value = `${row.name}:${type}`
    try {
      await createTask({ type, package: row.name })
      ElMessage.success('任务已创建，可在「元数据 → 任务」查看进度')
      await load()
    } finally {
      submitting.value = ''
    }
  }

  async function remove(row: MetadataPackage) {
    try {
      await ElMessageBox.confirm(
        `删除 ${row.name} 的本地压缩包？已解压的媒体目录不会被删除，但重新解压需要重新下载。`,
        '删除压缩包',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
    await deleteArchive(row.name)
    ElMessage.success('已删除压缩包')
    await load()
  }

  // 容量与包状态会变化，用可配置自动刷新代替写死的 10 秒
  const auto = useAutoRefresh({
    storageKey: 'fn-xiaoya:packages-refresh',
    run: load,
    defaultInterval: 10_000
  })
  const refreshInterval = auto.interval
  const refreshOptions = auto.options
  const doRefresh = auto.refresh

  onMounted(() => {
    void auto.start()
  })
</script>

<style lang="scss" scoped>
  .packages {
    // 卡片间统一 20px 间距：由容器控制，不依赖 GlassPanel 的相邻兄弟选择器
    display: flex;
    flex-direction: column;
    gap: 20px;

    &__controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    &__label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__interval {
      width: 104px;
    }

    &__capacity {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__bar {
      height: 10px;
      overflow: hidden;
      background: rgb(148 163 184 / 25%);
      border-radius: 999px;
    }

    &__bar-inner {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #22d3ee);
      border-radius: 999px;
      transition: width 0.3s ease;
    }

    &__capacity-text {
      margin: 0;
      font-size: 13px;
      color: var(--el-text-color-regular);
    }

    &__name {
      display: flex;
      flex-direction: column;
      line-height: 1.4;

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__hint {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      &--note {
        margin-top: 12px;
      }
    }
  }
</style>
