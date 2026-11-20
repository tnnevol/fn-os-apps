<!--
  元数据同步（对齐 xiaoya_db / solid.py）。

  与「元数据包」页的分工：
  - 元数据包：下载整包 + 解压，用于首次铺底；
  - 本页：按文件增量同步（nfo/图片/strm），日常定时更新用这个。

  两个关键概念要讲清楚，否则用户会配错：
  1) 只同步勾选的顶层目录，不勾不下载，避免一次拉全站；
  2) strm 里的地址会被「替换」，因此本地文件大小与线上必然不同，
     应用改用 <文件名>.<线上大小>.meta 标记是否已同步。
-->
<template>
  <div class="sync">
    <GlassPanel title="同步设置" description="从小雅元数据站按文件增量同步，只更新有变化的文件。">
      <ElForm label-width="150px" label-position="left">
        <ElFormItem label="启用同步">
          <ElSwitch v-model="form.enabled" />
          <span class="sync__hint">关闭后手动与定时同步都不执行。</span>
        </ElFormItem>

        <ElFormItem label="同步目录">
          <div class="sync__dirs">
            <!--
              用 ElTreeSelect：多选下拉 + 内嵌树，原生支持懒加载与搜索。
              比「标签 + 独立对话框」更紧凑，选中态由组件自己维护。
            -->
            <ElTreeSelect
              v-model="selectedPaths"
              :props="treeProps"
              :cache-data="treeCacheData"
              node-key="path"
              multiple
              show-checkbox
              filterable
              clearable
              lazy
              :load="loadTreeNode as any"
              placeholder="选择要同步的目录"
              class="sync__tree-select"
            />

            <div class="sync__dir-actions">
              <ElButton size="small" text :loading="treeLoading" @click="reloadTree">
                刷新目录
              </ElButton>
              <span v-if="mirrorInfo" class="sync__mirror">
                当前镜像：<code>{{ mirrorInfo }}</code>
              </span>
            </div>

            <p class="sync__hint sync__hint--block">
              目录树由 NAS 从最快的镜像代理抓取。可展开到子目录后勾选以减少同步量；
              首次建议先只勾「每日更新」试跑一次。
            </p>
          </div>
        </ElFormItem>

        <ElFormItem label="strm 地址替换">
          <div class="sync__strm">
            <ElInput
              v-model="form.strmFrom"
              placeholder="被替换的内容，例如 http://xiaoya.host:5678/d"
            />
            <span class="sync__arrow">→</span>
            <ElInput
              v-model="form.strmTo"
              placeholder="替换成的地址，例如 https://pan.example.com/d/xiaoya"
            />
          </div>
          <p class="sync__hint sync__hint--block">
            两项都填写才会替换；留空则按线上原文写入。替换后文件大小会变， 应用用
            <code>文件名.线上大小.meta</code> 标记同步状态，不会因此重复下载。
          </p>
        </ElFormItem>

        <ElFormItem label="同时更新 nfo">
          <ElSwitch v-model="form.nfo" />
          <span class="sync__hint">关闭后只同步 strm 与图片。</span>
        </ElFormItem>

        <ElFormItem label="并发数">
          <ElInputNumber v-model="form.count" :min="limits.min" :max="limits.max" />
          <span class="sync__hint"> 同时下载的文件数，压力大就调小。 </span>
          <p v-if="capacity" class="sync__hint sync__hint--block">
            <!--
              16 是「这台设备适合用多少」的推荐值，不是上限：
              上游脚本按网盘类型给 2/4/6 线程，本身没有上限概念，
              这里也不该把推荐值说成封顶。
            -->
            推荐 <strong>{{ capacity.recommended }}</strong>（{{ capacity.reason }}）。
            这是按设备性能算出的建议值，不是上限，可自行调高至 {{ limits.max }}。
            <ElButton
              v-if="form.count !== capacity.recommended"
              link
              type="primary"
              @click="form.count = capacity.recommended"
            >
              用推荐值
            </ElButton>
          </p>
        </ElFormItem>

        <ElFormItem label="定时执行">
          <div class="sync__schedule">
            <!--
              用「模式 + 时间」而不是日期面板：原生日期面板要求年月日时分
              五项逐级选全，对「每天凌晨 3 点」这类需求是多余负担。
              这里按模式只暴露必填字段，与定时器语义一致。
            -->
            <ElSelect v-model="schedule.mode" class="sync__schedule-mode">
              <ElOption label="不启用定时" value="off" />
              <ElOption label="每天" value="daily" />
              <ElOption label="每周" value="weekly" />
              <ElOption label="每月" value="monthly" />
            </ElSelect>

            <template v-if="schedule.mode !== 'off'">
              <ElSelect
                v-if="schedule.mode === 'weekly'"
                v-model="schedule.day"
                class="sync__schedule-day"
                placeholder="星期"
              >
                <ElOption v-for="(name, i) in WEEK_NAMES" :key="i" :label="name" :value="i" />
              </ElSelect>

              <ElSelect
                v-if="schedule.mode === 'monthly'"
                v-model="schedule.day"
                class="sync__schedule-day"
                placeholder="日期"
              >
                <ElOption v-for="d in 31" :key="d" :label="`${d} 日`" :value="d" />
              </ElSelect>

              <ElTimePicker
                v-model="scheduleTime"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="时间"
                class="sync__schedule-time"
              />
            </template>
          </div>
          <p class="sync__hint sync__hint--block">
            {{ scheduleAdvice }}
          </p>
        </ElFormItem>

        <ElFormItem>
          <ElButton type="primary" :loading="saving" @click="save">保存设置</ElButton>
          <ElButton :loading="starting" :disabled="state.running" @click="run">立即同步</ElButton>
        </ElFormItem>
      </ElForm>
    </GlassPanel>

    <GlassPanel title="同步状态" description="进度与最近一次结果">
      <template #header>
        <ElButton size="small" :loading="loading" @click="loadState">刷新</ElButton>
      </template>

      <ElDescriptions :column="2" size="small" border>
        <ElDescriptionsItem label="状态">
          <ElTag :type="statusType" effect="light" size="small">{{ statusText }}</ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="进度">
          {{ state.done }} / {{ state.total || '—' }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="已更新">{{ state.downloaded }}</ElDescriptionsItem>
        <ElDescriptionsItem label="已跳过">{{ state.skipped }}</ElDescriptionsItem>
        <ElDescriptionsItem label="失败">{{ state.failed }}</ElDescriptionsItem>
        <ElDescriptionsItem label="说明">{{ state.message || '—' }}</ElDescriptionsItem>
      </ElDescriptions>

      <ElProgress
        v-if="state.running && state.total > 0"
        :percentage="Math.floor((state.done / state.total) * 100)"
        :stroke-width="8"
        style="margin-top: 16px"
      />

      <pre class="sync__logs">{{ logs }}</pre>
    </GlassPanel>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Document, Folder } from '@element-plus/icons-vue'
  import GlassPanel from '@/components/glass/GlassPanel.vue'
  import {
    fetchMirrors,
    fetchSync,
    fetchSyncState,
    fetchSyncTree,
    runSync,
    saveSync,
    type SyncConfig,
    type ScheduleConfig,
    type SyncState,
    type SyncTreeNode
  } from '@/api/xiaoya'

  defineOptions({ name: 'SettingsSync' })

  const form = ref<SyncConfig>({
    enabled: false,
    paths: [],
    strmFrom: '',
    strmTo: '',
    count: 16,
    nfo: true,
    schedule: { mode: 'off', hour: 3, minute: 0, day: 1 }
  })
  const availablePaths = ref<string[]>([])
  /** 设备性能推荐值（并发数等） */
  const capacity = ref<{
    recommended: number
    cores: number
    freeMb: number
    totalMb: number
    reason: string
  } | null>(null)
  const limits = ref({ min: 4, max: 16 })

  /* ── 目录树选择 ─────────────────────────────────────── */

  const treeLoading = ref(false)
  /**
   * 已加载过的节点缓存。
   *
   * 不直接喂给 :data（lazy 模式下那会和 load 结果叠成两份），
   * 只用于「把已选路径翻译成显示名称」和收集已知路径。
   */
  const treeData = ref<TreeNode[]>([])
  /** ElTreeSelect 的选中值（即 form.paths 的双向镜像） */
  const selectedPaths = ref<string[]>([])
  /** 当前使用的镜像，展示给用户知道在跟谁同步 */
  const mirrorInfo = ref('')

  /** 树节点：ElTree 需要 leaf 字段判断是否显示展开箭头。 */
  interface TreeNode extends SyncTreeNode {
    leaf?: boolean
    children?: TreeNode[]
  }
  /** 定时调度：模式 + 时间，后端按此判断是否触发 */
  const schedule = ref<ScheduleConfig>({
    mode: 'off',
    hour: 3,
    minute: 0,
    day: 1
  })

  /** 星期名称，索引即后端 day 值（0=周日） */
  const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

  /**
   * 时间选择器的中转值（'HH:mm'）。
   *
   * 拆成独立 ref 是因为 ElTimePicker 只接受字符串，
   * 而 schedule 里存的是 hour/minute 两个数字；两边保持同步。
   */
  const scheduleTime = computed({
    get: () =>
      `${String(schedule.value.hour).padStart(2, '0')}:${String(schedule.value.minute).padStart(2, '0')}`,
    set: (value: string | null) => {
      if (value === null || value === '') return
      const [h, m] = value.split(':').map(Number)
      if (Number.isInteger(h) && Number.isInteger(m)) {
        schedule.value.hour = h
        schedule.value.minute = m
      }
    }
  })

  /** 当前调度的可读描述，同时充当提示文案。 */
  const scheduleAdvice = computed(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const time = `${pad(schedule.value.hour)}:${pad(schedule.value.minute)}`
    if (schedule.value.mode === 'off') {
      return '不启用定时，只能手动点「立即同步」。应用停止运行期间不会补跑。'
    }
    if (schedule.value.mode === 'daily')
      return `每天 ${time} 自动同步一次。应用停止运行期间不会补跑。`
    if (schedule.value.mode === 'weekly') {
      return `每${WEEK_NAMES[schedule.value.day] ?? ''} ${time} 自动同步一次。`
    }
    const day = schedule.value.day
    const warn = day > 28 ? '（部分月份没有该日期，那些月份将跳过）' : ''
    return `每月 ${day} 日 ${time} 自动同步一次${warn}。`
  })
  const state = ref<SyncState>({
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    total: 0,
    done: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    message: '',
    logs: [],
    running: false
  })

  const saving = ref(false)
  const starting = ref(false)
  const loading = ref(false)

  const STATUS_TEXT: Record<string, string> = {
    idle: '未运行',
    running: '同步中',
    succeeded: '已完成',
    failed: '失败'
  }

  const statusText = computed(() => STATUS_TEXT[state.value.status] ?? state.value.status)
  const statusType = computed(() => {
    if (state.value.status === 'running') return 'primary'
    if (state.value.status === 'succeeded') return 'success'
    if (state.value.status === 'failed') return 'danger'
    return 'info'
  })

  const logs = computed(() => (state.value.logs ?? []).join('\n') || '（暂无日志）')

  async function load() {
    const res = await fetchSync()
    // 显式构造，避免把后端的可选字段带进 ref 的联合类型推导
    form.value = {
      enabled: res.data.config.enabled,
      paths: [...res.data.config.paths],
      strmFrom: res.data.config.strmFrom,
      strmTo: res.data.config.strmTo,
      count: res.data.config.count,
      nfo: res.data.config.nfo,
      schedule: { ...res.data.config.schedule }
    }
    // TreeSelect 的选中值与表单保持镜像；同时补齐 cacheData，
    // 否则未展开过的深层路径会以原始 path 显示
    selectedPaths.value = [...form.value.paths]
    onSelectChange(selectedPaths.value)
    availablePaths.value = res.data.availablePaths
    capacity.value = res.data.capacity ?? null
    if (res.data.limits) limits.value = res.data.limits
    schedule.value = { ...res.data.config.schedule }
    state.value = res.data.state
  }

  async function loadState() {
    loading.value = true
    try {
      const res = await fetchSyncState()
      state.value = res.data
    } finally {
      loading.value = false
    }
  }

  /* ── 目录树 ─────────────────────────────────────────── */

  /**
   * 加载某一层目录。
   *
   * 注意 lazy 模式下不能预填根层：ElTree 自己会调 load 拿根节点，
   * 若同时用本函数塞 treeData，根层会出现两份（实测重复显示）。
   * 因此这里只负责「按路径取一层」，由调用方决定放到哪。
   */
  async function loadTree(path = '') {
    treeLoading.value = true
    try {
      const res = await fetchSyncTree(path, 1)
      mirrorInfo.value = res.data.base
      return toTreeNodes(res.data.entries)
    } finally {
      treeLoading.value = false
    }
  }

  /** 后端条目转成 ElTree 节点；目录需要可展开，文件为叶子。 */
  function toTreeNodes(entries: SyncTreeNode[]): TreeNode[] {
    return entries.map((e) => ({
      ...e,
      // 目录挂 children=[] 让 ElTree 认为可展开，实际内容由 lazy load 填充
      children: e.isDir ? [] : undefined,
      leaf: !e.isDir
    }))
  }

  /**
   * ElTree 懒加载回调。
   *
   * resolve 空数组即表示「该目录下没有子目录」。
   */
  // ElTree 的 load 回调签名是 (Node, loadedCallback, stopLoading)。
  // Node 是组件内部实例类型，只依赖它的 data 字段；用 structural 类型声明，
  // 并把 data 收成 TreeNodeData 兼容的形态。
  function loadTreeNode(
    node: { level: number; data: TreeNode & Record<string, unknown> },
    resolve: (children: TreeNode[]) => void,
    stopLoading: () => void
  ): void {
    // ElTree 的 load 是同步签名，异步抓取放在 IIFE 里；
    // 结束时要调 stopLoading，否则节点会一直转圈。
    void (async () => {
      try {
        // level 0 是虚拟根，没有 data.path；此时抓顶层目录
        const path = node.level === 0 ? '' : (node.data?.path ?? '')
        const res = await fetchSyncTree(path, 1)
        if (node.level === 0) mirrorInfo.value = res.data.base
        const nodes = toTreeNodes(res.data.entries)

        // 关键：把加载结果登记到 known。
        // ElTree 内部维护自己的节点树，lazy 加载的子节点不会回写到 treeData，
        // 若不在这里登记，归一化就永远看不到父节点的子目录（children 恒为空），
        // 从而完全失效。
        recordLoaded(path, nodes)

        resolve(nodes)
      } catch {
        // 抓不到就当作没有子目录，避免整棵树卡住
        resolve([])
      } finally {
        stopLoading()
      }
    })()
  }

  /**
   * ElTreeSelect 的 props 映射：字段名与后端返回一致。
   * label 用 name（用户看到的目录名），children 由懒加载填充。
   */
  const treeProps = { label: 'name', children: 'children', isLeaf: 'leaf' } as const

  /**
   * 懒加载缓存。
   *
   * ElTreeSelect 在回显「已选中但尚未展开过」的节点时需要知道其 label，
   * 否则下拉里会显示原始 path。cacheData 就是给它补这份元数据。
   */
  const treeCacheData = ref<TreeNode[]>([])
  /** 归一化期间禁止 watch 重入（归一化本身会改 selectedPaths） */
  let normalizing = false

  /**
   * 已加载的子目录索引：父路径 → 子路径列表。
   *
   * 与 treeData 分离：treeData 只承载根层用于展示，
   * 而这份索引要在懒加载过程中持续累积，供归一化判断全选。
   */
  const loadedChildren = ref(new Map<string, string[]>())

  /** 登记一层加载结果。 */
  function recordLoaded(parentPath: string, nodes: TreeNode[]) {
    const next = new Map(loadedChildren.value)
    for (const node of nodes) {
      // 叶子节点不参与折叠判断，跳过
      if (node.leaf === true) continue
      const siblings = next.get(parentPath) ?? []
      if (!siblings.includes(node.path)) siblings.push(node.path)
      next.set(parentPath, siblings)
    }
    loadedChildren.value = next
  }

  /** 从树里收集所有已知节点（含已加载的子节点）。 */
  function collectKnown(nodes: TreeNode[], map: Map<string, TreeNode>) {
    for (const node of nodes) {
      map.set(node.path, node)
      if (Array.isArray(node.children) && node.children.length > 0) {
        collectKnown(node.children as TreeNode[], map)
      }
    }
  }

  /**
   * 归一化选中集合。
   *
   * 目标：勾选状态与用户意图一致，且不在标签里铺开一堆冗余项。
   *
   * 规则（自上而下处理父节点）：
   * - 子目录「明确全选」→ 收起父节点，只留父路径；
   * - 子目录「部分选中」→ 去掉父路径，保留具体子目录。
   *
   * 关键前提：只有「子目录已完整加载」时才敢判断全选。
   * 懒加载下没展开过的目录 children 为空，此时既不能认定全选
   * （否则会把父目录误折叠），也不能认定非全选（否则会把父目录误删）。
   * 因此对未加载的父节点保持原样。
   */
  function normalizeSelection(paths: string[]): string[] {
    const set = new Set(paths)
    const result = new Set(paths)
    const index = loadedChildren.value

    // 候选包含「已加载过的所有父节点」，不只是已选中的路径：
    // 用户可能只勾了全部子目录（父节点从未进过集合），也要能折叠成父节点。
    // 按层级升序处理，保证先判定上层。
    const candidates = [...new Set([...set, ...index.keys()])].sort(
      (a, b) => a.split('/').length - b.split('/').length
    )

    for (const path of candidates) {
      const childPaths = index.get(path)
      // 该目录的子层还没加载过 → 无从判断，保持用户原样
      if (childPaths === undefined || childPaths.length === 0) continue
      // 一个子目录都没选 → 与父节点无关，跳过（否则会误删父节点）
      if (!childPaths.some((p) => set.has(p))) continue

      if (childPaths.every((p) => set.has(p))) {
        // 子目录全选：收起父路径，移除所有子路径
        result.add(path)
        for (const p of childPaths) result.delete(p)
      } else {
        // 部分选中：父路径代表不了用户意图，去掉它，保留具体子项
        result.delete(path)
      }
    }

    return [...result]
  }

  /** 选中值变化：归一化后写入表单，并登记 cacheData 供回显。 */
  function onSelectChange(value: unknown) {
    const raw = Array.isArray(value) ? (value as string[]) : []
    const normalized = normalizeSelection(raw)
    form.value.paths = normalized

    // cacheData 用 treeData 构建（仅根层），缺失的深层条目下面单独补
    const known = new Map<string, TreeNode>()
    collectKnown(treeData.value, known)

    // 归一化改变了集合时，把 v-model 拉回一致，避免界面与表单不同步。
    // 用 normalizing 标记挡住 watch 重入，否则会来回抖动。
    if (normalized.length !== raw.length || normalized.some((p) => !raw.includes(p))) {
      normalizing = true
      selectedPaths.value = normalized
      void nextTick(() => {
        normalizing = false
      })
    }

    // 补 cacheData：让未展开过的深层节点也能显示名称而不是路径
    const missing = normalized
      .filter((p) => !known.has(p))
      .map((p) => ({
        name: p.split('/').pop() ?? p,
        path: p,
        isDir: true,
        leaf: false,
        children: []
      }))
    if (missing.length > 0) {
      const merged = new Map(treeCacheData.value.map((n) => [n.path, n]))
      for (const item of missing) merged.set(item.path, item)
      treeCacheData.value = [...merged.values()]
    }
  }

  // 用 watch 而不是组件的 @change：勾选子节点时 ElTreeSelect 不一定抛 change，
  // 而 v-model 一定会更新，更适合作为归一化的触发点。
  watch(
    selectedPaths,
    (value) => {
      // 归一化内部会把 selectedPaths 拉回一致，避免这里重复触发
      if (normalizing) return
      onSelectChange(value)
    },
    { deep: true }
  )

  /** 刷新目录：清空懒加载缓存后重新抓根层。 */
  async function reloadTree() {
    treeCacheData.value = []
    try {
      // 探测一次以刷新「当前镜像」信息；树内容交给组件的 lazy load
      treeData.value = await loadTree('')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载目录失败')
    }
  }

  async function save() {
    saving.value = true
    try {
      const res = await saveSync({
        ...form.value,
        schedule: { ...schedule.value }
      })
      // 显式构造，避免把后端的可选字段带进 ref 的联合类型推导
      form.value = {
        enabled: res.data.config.enabled,
        paths: [...res.data.config.paths],
        strmFrom: res.data.config.strmFrom,
        strmTo: res.data.config.strmTo,
        count: res.data.config.count,
        nfo: res.data.config.nfo,
        schedule: { ...res.data.config.schedule }
      }
      ElMessage.success('同步设置已保存')
    } finally {
      saving.value = false
    }
  }

  async function run() {
    starting.value = true
    try {
      await runSync()
      ElMessage.success('同步已开始，可在下方查看进度')
      await loadState()
    } finally {
      starting.value = false
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(async () => {
    await load()
    // 首次进入先探一次镜像，让「当前镜像」有值；失败不影响其它功能
    void loadTree('')
      .then((nodes) => {
        treeData.value = nodes
      })
      .catch(() => undefined)
    // 同步是后台任务，轮询比让用户手点刷新更符合预期
    timer = setInterval(() => {
      if (state.value.running) void loadState()
    }, 3000)
  })

  onUnmounted(() => {
    if (timer !== undefined) clearInterval(timer)
  })
</script>

<style lang="scss" scoped>
  .sync {
    // 卡片间统一 20px 间距：由容器控制，不依赖 GlassPanel 的相邻兄弟选择器
    display: flex;
    flex-direction: column;
    gap: 20px;

    &__hint {
      margin-left: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      &--block {
        display: block;
        margin: 6px 0 0;
        line-height: 1.6;
      }
    }

    &__dirs {
      width: 100%;
    }

    &__tree-select {
      width: 100%;
      max-width: 640px;
    }

    &__schedule {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    &__schedule-mode {
      width: 140px;
    }

    &__schedule-day {
      width: 110px;
    }

    &__schedule-time {
      width: 130px;
    }

    &__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-height: 32px;
    }

    &__dir-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
    }

    &__mirror {
      font-size: 12px;
      color: var(--el-text-color-secondary);

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
    }

    &__tree {
      min-height: 200px;
      max-height: 46vh;
      overflow: auto;
    }

    &__tree-node {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    &__strm {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      max-width: 720px;
    }

    &__arrow {
      flex-shrink: 0;
      color: var(--el-text-color-secondary);
    }

    &__logs {
      max-height: 34vh;
      padding: 12px;
      margin: 16px 0 0;
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
