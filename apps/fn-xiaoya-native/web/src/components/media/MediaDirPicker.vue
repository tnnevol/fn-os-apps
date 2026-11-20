<!--
  元数据目录管理。

  对应 all_in_one.sh 的 `get_media_dir`：脚本让用户手输一个绝对路径，
  然后无条件 chmod 777 并把元数据解压进去。这里改成飞牛的方式：
  用户通过系统目录选择器授权一个目录，应用只在这个目录里工作。

  关键约束：
  - 没有授权就不能选目录：前端不提供「手输路径」入口，
    后端也会用已授权目录列表做二次校验，前端被改也绕不过去；
  - 开发环境没有宿主能力时，明确说明「请在飞牛中使用」，
    而不是给一个点了没反应的按钮。
-->
<template>
  <div class="media-dir">
    <!-- 未配置目录：引导授权 -->
    <ElAlert
      v-if="!state.configured"
      type="warning"
      show-icon
      :closable="false"
      title="还没有选择元数据目录"
      description="小雅的元数据（影片刮削信息）需要放在你指定的目录里。请先授权一个目录，再进行下载与解压。"
      class="media-dir__alert"
    />

    <div class="media-dir__bar">
      <div class="media-dir__current">
        <span class="media-dir__label">当前目录</span>
        <code v-if="state.path" class="media-dir__path">{{ state.path }}</code>
        <span v-else class="media-dir__empty">未配置</span>
      </div>
      <div class="media-dir__buttons">
        <ElButton type="primary" :loading="picking" @click="pickFolder"> 选择目录 </ElButton>
        <ElButton v-if="state.authAvailable" :loading="loadingRoots" @click="openRoots">
          已有授权目录
        </ElButton>
      </div>
    </div>

    <!-- 开发环境说明：避免用户以为功能坏了 -->
    <ElAlert
      v-if="!state.authAvailable"
      type="info"
      show-icon
      :closable="false"
      title="当前环境不支持目录授权"
      description="目录选择器依赖飞牛桌面宿主。请在飞牛中打开本应用完成授权；开发环境可使用默认目录继续调试其它功能。"
      class="media-dir__alert"
    />

    <!-- 已授权目录列表 -->
    <div v-if="roots.length > 0" class="media-dir__roots">
      <p class="media-dir__label">选择已授权目录</p>
      <ElRadioGroup v-model="selectedRoot" class="media-dir__root-list">
        <ElRadio v-for="p in roots" :key="p" :value="p" class="media-dir__root-item">
          <code>{{ p }}</code>
        </ElRadio>
      </ElRadioGroup>
      <ElButton type="primary" plain :loading="saving" @click="saveSelectedRoot"
        >使用该目录</ElButton
      >
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { fetchMediaDir, fetchMediaRoots, saveMediaDir, type MediaDirState } from '@/api/xiaoya'
  import { onAuthCallback, pickSharedFolder } from '@/utils/trimAuth'

  defineOptions({ name: 'MediaDirPicker' })

  const emit = defineEmits<{ changed: [path: string] }>()

  const state = ref<MediaDirState>({
    root: '',
    subdir: '',
    path: null,
    configured: false,
    authAvailable: false
  })
  const roots = ref<string[]>([])
  /** 已授权目录弹框 */
  const rootsVisible = ref(false)
  const selectedRoot = ref('')
  const picking = ref(false)
  const saving = ref(false)
  const loadingRoots = ref(false)

  async function load() {
    const res = await fetchMediaDir()
    state.value = res.data
  }

  /** 打开飞牛目录选择器；选中后立即保存为元数据目录。 */
  async function pickFolder() {
    picking.value = true
    try {
      const result = await pickSharedFolder()
      if (!result.supported) {
        ElMessage.warning(result.reason ?? '当前环境不支持目录授权')
        return
      }
      if (result.paths.length === 0) {
        // 独立浏览器路径：授权在系统页完成，结果通过 postMessage 回来，
        // 这里只提示用户继续操作，不当成失败。
        if (result.reason) ElMessage.info(result.reason)
        return
      }
      await saveMediaDir({ root: result.paths[0] })
      ElMessage.success('元数据目录已设置')
      await load()
      emit('changed', state.value.path ?? '')
    } finally {
      picking.value = false
    }
  }

  /**
   * 授权目录树节点。
   *
   * 后端返回的是扁平路径，按 / 分段还原成层级：
   * 同一层级的相同前缀合并成同一个节点，避免根下出现一长串重复路径。
   */
  interface RootNode {
    name: string
    path: string
    isDir: boolean
    /** 只有「被授权的那个目录」本身可选，中间层级只用于展示结构 */
    selectable: boolean
    children?: RootNode[]
  }

  const rootTree = ref<RootNode[]>([])

  /**
   * 把扁平路径列表还原成树。
   *
   * 例：/vol2/1000/xiaoya-meta 与 /vol2/1000/music-古典
   * → vol2 → 1000 → { xiaoya-meta, music-古典 }
   *
   * @param paths 已授权目录的完整路径
   * @returns 树形结构
   */
  function buildTree(paths: string[]): RootNode[] {
    const root: RootNode = { name: '', path: '', isDir: true, selectable: false, children: [] }

    for (const full of paths) {
      const segments = full.split('/').filter((seg) => seg !== '')
      let current = root

      segments.forEach((seg, index) => {
        const isLast = index === segments.length - 1
        const nodePath = `/${segments.slice(0, index + 1).join('/')}`
        let child = current.children?.find((item) => item.name === seg)
        if (child === undefined) {
          child = {
            name: seg,
            path: nodePath,
            isDir: true,
            // 只有路径末尾才是「被授权的目录」本身
            selectable: isLast,
            children: []
          }
          current.children?.push(child)
        } else if (isLast) {
          // 某条授权路径恰是另一条的前缀时，把它也标为可选
          child.selectable = true
        }
        current = child
      })
    }

    return root.children ?? []
  }

  /** 打开弹框并拉取一次已授权目录。 */
  async function openRoots() {
    rootsVisible.value = true
    loadingRoots.value = true
    try {
      const res = await fetchMediaRoots()
      if (!res.data.available) {
        ElMessage.warning(res.data.reason || '无法读取授权目录')
        roots.value = []
        rootTree.value = []
        return
      }
      roots.value = res.data.paths
      rootTree.value = buildTree(roots.value)
      // 当前目录若在授权列表里，默认选中它
      selectedRoot.value = roots.value.includes(state.value.root) ? state.value.root : ''
    } finally {
      loadingRoots.value = false
    }
  }

  /** 点击树节点：只有已授权目录本身可选。 */
  function onNodeClick(data: RootNode) {
    if (!data.selectable) return
    selectedRoot.value = data.path
  }

  async function saveSelectedRoot() {
    if (selectedRoot.value === '') return
    saving.value = true
    try {
      await saveMediaDir({ root: selectedRoot.value })
      ElMessage.success('元数据目录已设置')
      await load()
      emit('changed', state.value.path ?? '')
    } finally {
      saving.value = false
    }
  }

  /**
   * 授权回调：系统授权页完成后，回调页 postMessage 回来。
   *
   * 独立浏览器下这是唯一能拿到授权结果的途径，
   * 收到后直接把目录保存为元数据目录。
   */
  const stopAuthListen = onAuthCallback(async (paths) => {
    const root = paths[0]
    if (root === undefined) return
    try {
      await saveMediaDir({ root })
      ElMessage.success('元数据目录已设置')
      await load()
      emit('changed', state.value.path ?? '')
    } catch {
      // 错误提示由 HTTP 层统一弹出，这里不重复
    }
  })

  // SDK 握手已在应用启动时预热（见 main.ts），这里只加载目录配置
  onMounted(load)

  onUnmounted(stopAuthListen)

  // 供父组件在需要时刷新（例如授权后返回）
  defineExpose({ reload: load })
</script>

<style lang="scss" scoped>
  .media-dir {
    &__alert {
      margin-bottom: 16px;
      border-radius: 10px;
    }

    &__bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    &__current {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    &__label {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__path {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--el-text-color-primary);
      word-break: break-all;
    }

    &__empty {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    &__buttons {
      display: flex;
      flex-shrink: 0;
      gap: 8px;
    }

    &__tree-node {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    // 去掉「已授权」标签后靠字重区分：树里能列出的末级节点才是可选的，
    // 中间层级（vol2/1000）不能选，只用于展示结构
    &__tree-node--selectable {
      font-weight: 600;
    }

    &__tree-tip {
      float: left;
      max-width: 60%;
      overflow: hidden;
      font-size: 12px;
      line-height: 32px;
      color: var(--el-text-color-secondary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
