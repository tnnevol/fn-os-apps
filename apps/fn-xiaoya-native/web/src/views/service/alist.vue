<!--
  小雅服务页。

  对应脚本的安装/更新/卸载菜单与容器启停。
  关键差别：操作只有固定的四个，面板不能传入任意 Docker 命令——
  应用加入 docker 组后拥有的权限接近 root，这条边界必须由后端守，
  前端只负责不提供越界入口。
-->
<template>
  <div class="alist">
    <GlassPanel title="运行状态" description="容器由本应用的固定 Compose 项目管理">
      <template #header>
        <ElButton size="small" :loading="loading" @click="load">刷新</ElButton>
      </template>

      <ElDescriptions :column="2" size="small" border>
        <ElDescriptionsItem label="状态">
          <ElTag :type="status?.running ? 'success' : 'info'" effect="light" size="small">
            {{ status?.running ? '运行中' : status?.exists ? '已停止' : '未创建' }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="镜像">{{ status?.image || image || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="详细状态">{{ status?.statusText || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="端口">
          <span v-if="status?.ports?.length">{{ status.ports.join('，') }}</span>
          <span v-else>—</span>
        </ElDescriptionsItem>
      </ElDescriptions>

      <div class="alist__actions">
        <ElButton
          type="primary"
          :loading="acting"
          :disabled="status?.running"
          @click="act('start')"
        >
          启动
        </ElButton>
        <ElButton :loading="acting" :disabled="!status?.running" @click="act('stop')"
          >停止</ElButton
        >
        <ElButton :loading="acting" @click="act('restart')">重启</ElButton>
        <ElButton :loading="acting" @click="act('update')">更新镜像并重建</ElButton>
      </div>

      <!--
        不再写「http://NAS地址:5678」这种占位文本：地址是可推导的，
        而且走统一网关后不该让用户去拼端口。
        改为直接给可点击的入口，默认走应用自己的网关路径。
      -->
      <div class="alist__open">
        <ElDropdown split-button type="primary" :disabled="!openEntries.length" @click="openFirst" @command="openEntry">
          <span class="alist__open-label">打开</span>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem v-for="item in openEntries" :key="item.key" :command="item.key">
                {{ item.label }}
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
        <span class="alist__open-hint">{{ openHint }}</span>
      </div>
    </GlassPanel>

    <GlassPanel title="容器日志" description="只读取最近 200 行，避免大日志拖慢页面">
      <template #header>
        <div class="alist__log-controls">
          <span class="alist__log-label">自动刷新</span>
          <ElSelect v-model="autoRefresh" size="small" class="alist__interval">
            <ElOption
              v-for="opt in REFRESH_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
          <ElButton size="small" :loading="logsLoading" @click="loadLogs">刷新日志</ElButton>
        </div>
      </template>
      <pre class="alist__logs">{{ logDisplay }}</pre>
    </GlassPanel>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import { loadAll } from '@/utils/loadAll'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import {
    alistAction,
    fetchAddresses,
    fetchAlistImage,
    fetchAlistLogs,
    fetchAlistStatus,
    type AddressInfo,
    type AlistStatus
  } from '@/api/xiaoya'

  defineOptions({ name: 'ServiceAlist' })

  /** 应用在统一网关下的固定前缀（与 app/ui/config 的 gatewayPrefix 一致） */
  const BASE_PREFIX = '/app/fn-xiaoya-native'

  const status = ref<AlistStatus | null>(null)
  /** 地址信息：用于拼小雅面板的直达链接 */
  const addresses = ref<AddressInfo | null>(null)
  /**
   * 「打开」入口列表。
   *
   * 默认走应用自己的网关前缀（`/app/fn-xiaoya-native/alist/`）：
   * 统一网关只注册一个前缀，小雅面板由后端反向代理转发到 5678，
   * 这样既带上网关登录态，公网场景也能用。
   *
   * 用户若在常规设置里填了对外地址（内含分享链接所需域名），
   * 再追加一个直连端口项，便于局域网内不经过网关访问。
   */
  const openEntries = computed(() => {
    if (!status.value?.running) return []
    const list = [
      { key: 'gateway', label: '网页面板（网关）', url: `${BASE_PREFIX}/alist/` },
    ]
    const direct = addresses.value?.dockerAddress ?? ''
    if (direct !== '') {
      list.push({ key: 'web', label: `网页面板（直连 ${direct}）`, url: direct })
      list.push({ key: 'dav', label: 'WebDAV（直连，用户名 dav）', url: `${direct}/dav` })
    }
    return list
  })

  /** 下拉旁的一句说明：告诉用户「打开」实际会跳到哪里。 */
  const openHint = computed(() => {
    if (!status.value?.running) return '容器未运行，启动后可打开'
    if ((addresses.value?.dockerAddress ?? '') === '') {
      return '经统一网关访问；可在「常规设置」补对外地址后直连'
    }
    return '优先走网关；下拉可选直连地址'
  })

  /** 点主按钮：默认打开网关入口。 */
  function openFirst() {
    const first = openEntries.value[0]
    if (first) window.open(first.url, '_blank', 'noopener,noreferrer')
  }

  /** 下拉选择某个入口。 */
  function openEntry(key: string) {
    const item = openEntries.value.find((entry) => entry.key === key)
    if (item) window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  const image = ref('')
  const logs = ref('')
  const loading = ref(false)
  const acting = ref(false)
  const logsLoading = ref(false)
  /** 后端报告的「日志暂不可用」原因；非空时不展示空白 */
  const logsUnavailable = ref('')
  const logsReason = ref('')

  /** 日志自动刷新间隔（毫秒）；0 表示不自动刷新。 */
  const REFRESH_OPTIONS = [
    { label: '不刷新', value: 0 },
    { label: '5 秒', value: 5000 },
    { label: '10 秒', value: 10000 },
    { label: '30 秒', value: 30000 }
  ] as const

  // 默认 5 秒：看容器启动/报错时，5 秒能及时看到变化又不至于刷屏。
  // 记住用户上次选择，避免每次进页面都要重设。
  const AUTO_REFRESH_KEY = 'fn-xiaoya:log-refresh-interval'
  const VALID_INTERVALS: number[] = REFRESH_OPTIONS.map((o) => o.value)

  /**
   * 读取上次选择。
   *
   * 注意不能直接 Number(localStorage.getItem(...))：没存过时得到的是
   * Number(null) === 0，而 0 恰好是合法值（不刷新），会被误判成
   * 「用户选择过不刷新」。必须先判空再转换。
   */
  function initialInterval(): number {
    const raw = localStorage.getItem(AUTO_REFRESH_KEY)
    if (raw === null) return 5000
    const parsed = Number(raw)
    return VALID_INTERVALS.includes(parsed) ? parsed : 5000
  }

  const autoRefresh = ref<number>(initialInterval())
  let logTimer: ReturnType<typeof setInterval> | undefined

  async function load() {
    loading.value = true
    try {
      // Docker 未就绪时状态接口会失败；不能因此让整页报错
      const [statusRes, imageRes] = await loadAll([fetchAlistStatus(), fetchAlistImage()])
      if (statusRes.data) status.value = statusRes.data.data
      if (imageRes.data) image.value = imageRes.data.data.image
    } finally {
      loading.value = false
    }
  }

  /**
   * 日志区展示内容。
   *
   * 拉取失败或 Docker 不可用时，后端会返回 unavailable 而不是 500，
   * 这里把它翻译成一句人话，避免一片空白让人以为页面挂了。
   */
  const logDisplay = computed(() => {
    if (logs.value !== '') return logs.value
    if (logsUnavailable.value !== '') {
      return `（无法读取日志：${logsUnavailable.value}${
        logsReason.value ? `；${logsReason.value}` : ''
      }）`
    }
    return '（暂无日志，容器可能尚未创建）'
  })

  async function loadLogs() {
    logsLoading.value = true
    try {
      const res = await fetchAlistLogs(200)
      logs.value = res.data.logs ?? ''
      logsUnavailable.value = res.data.unavailable ?? ''
      logsReason.value = res.data.reason ?? ''
    } catch (error) {
      // Docker 未运行 / 容器未创建时该接口返回 500。
      // 自动刷新会周期性触发，若不吞掉错误就会变成每 5 秒一条
      // 未捕获的 Promise 拒绝，控制台被刷屏。
      // 这里把原因写进日志区，用户看得到，且不打断自动刷新。
      const message = error instanceof Error ? error.message : String(error)
      logs.value = `（无法读取日志：${message}）`
    } finally {
      logsLoading.value = false
    }
  }

  async function act(action: 'start' | 'stop' | 'restart' | 'update') {
    acting.value = true
    try {
      const res = await alistAction(action)
      ElMessage.success(res.data.message)
      await load()
      await loadLogs()
    } finally {
      acting.value = false
    }
  }

  /**
   * 按当前间隔重建日志定时器。
   *
   * 单独一个定时器而不是并入状态轮询：日志请求体积比状态大，
   * 用户可能希望状态 15 秒刷、日志只在需要时刷。
   */
  function restartLogTimer() {
    if (logTimer !== undefined) {
      clearInterval(logTimer)
      logTimer = undefined
    }
    if (autoRefresh.value > 0) {
      logTimer = setInterval(() => {
        // 上一次还没回来就跳过，避免慢请求堆积
        if (!logsLoading.value) void loadLogs()
      }, autoRefresh.value)
    }
  }

  // 切换下拉立即生效，不必等当前周期走完
  watch(autoRefresh, (value) => {
    // 记住选择；值来自下拉，一定是合法选项
    localStorage.setItem(AUTO_REFRESH_KEY, String(value))
    restartLogTimer()
    // 刚从「不刷新」切到有间隔时，先取一次让用户马上看到新内容
    if (autoRefresh.value > 0) void loadLogs()
  })

  // 容器状态也用同一套自动刷新机制，间隔同样可选
  const stateAuto = useAutoRefresh({
    storageKey: 'fn-xiaoya:alist-state-refresh',
    run: load,
    defaultInterval: 10_000
  })
  const stateInterval = stateAuto.interval
  const stateOptions = stateAuto.options
  const stateManualLoading = stateAuto.manualLoading
  const refreshState = stateAuto.refresh

  /**
   * 小雅面板地址。
   *
   * 优先用 `docker_address.txt`：那是小雅生成分享链接时用的对外地址，
   * 用户在设置里选定过，最符合他的实际网络。缺失时退回到
   * 「当前访问本应用所用的主机名 + 5678」——本应用和小雅同机，
   * 这个推导在绝大多数场景下是对的。
   */
  const panelUrl = computed(() => {
    const saved = addresses.value?.dockerAddress ?? ''
    if (saved !== '') return saved.replace(/\/+$/, '')
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location
      return `${protocol}//${hostname}:5678`
    }
    return ''
  })

  /** 新标签页打开小雅面板。 */
  function openPanel() {
    const url = panelUrl.value
    if (url === '') return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  onMounted(async () => {
    await stateAuto.start()
    // 地址用于拼面板链接；失败不影响其它功能，因此不阻断
    try {
      const res = await fetchAddresses()
      addresses.value = res.data
    } catch {
      addresses.value = null
    }
    // 进入页面就取一次日志，否则要等到第一个周期才有内容
    void loadLogs()
    restartLogTimer()
  })

  onUnmounted(() => {
    // 只清理日志定时器；状态定时器由 composable 自己清理
    if (logTimer !== undefined) clearInterval(logTimer)
  })
</script>

<style lang="scss" scoped>
  .alist {
    // 卡片间统一 20px 间距：由容器控制，不依赖 GlassPanel 的相邻兄弟选择器
    display: flex;
    flex-direction: column;
    gap: 20px;

    &__log-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    &__log-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__interval {
      width: 104px;
    }

    &__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    // 「打开」入口：下拉按钮与说明同行，窄屏时说明换到下一行
    &__open {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-top: 16px;
    }

    &__open-hint {
      font-size: 12px;
      color: var(--art-text-gray-500, var(--el-text-color-secondary));
    }

    &__logs {
      max-height: 46vh;
      padding: 12px;
      margin: 0;
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
