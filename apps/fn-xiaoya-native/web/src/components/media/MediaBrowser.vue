<!--
  授权目录内的文件浏览器。

  只做用户要求的四件事：浏览、新建文件夹、重命名、删除。
  上传/下载文件不在这里做——元数据由应用自己的任务下载，
  让用户通过这个面板传大文件没有意义。

  安全边界由后端负责：这里传的路径都会在服务端校验
  「必须落在已授权根内」，并检查当前用户 ACL。
-->
<template>
  <div class="browser">
    <div class="browser__toolbar">
      <div class="browser__nav">
        <ElButton size="small" :disabled="parent === null" @click="go(parent)">上一级</ElButton>
        <ElButton size="small" :loading="loading" @click="load(current)">刷新</ElButton>
      </div>
      <div class="browser__actions">
        <ElButton size="small" type="primary" @click="openCreate">新建文件夹</ElButton>
      </div>
    </div>

    <p class="browser__path">
      <span class="browser__path-label">位置</span>
      <code>{{ current }}</code>
    </p>

    <ElTable
      v-loading="loading"
      :data="items"
      empty-text="这个目录还是空的"
      size="small"
      row-key="path"
      :show-overflow-tooltip="true"
    >
      <ElTableColumn label="名称" min-width="220">
        <template #default="{ row }">
          <span class="browser__name">
            <ElIcon v-if="row.type === 'dir'"><Folder /></ElIcon>
            <ElIcon v-else><Document /></ElIcon>
            <a
              v-if="row.type === 'dir'"
              href="javascript:void(0)"
              class="browser__link"
              @click="go(row.path)"
            >
              {{ row.name }}
            </a>
            <span v-else>{{ row.name }}</span>
          </span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="类型" width="90">
        <template #default="{ row }">
          <ElTag :type="row.type === 'dir' ? 'primary' : 'info'" effect="light" size="small">
            {{ row.type === 'dir' ? '文件夹' : '文件' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="大小" width="110">
        <template #default="{ row }">
          {{ row.type === 'dir' ? '—' : formatBytes(row.size) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="修改时间" width="170">
        <template #default="{ row }">{{ formatTime(row.mtime) }}</template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <ElButton size="small" text @click="openRename(asEntry(row))">重命名</ElButton>
          <ElButton size="small" text type="danger" @click="remove(asEntry(row))">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <!--
      空状态交给 ElTable 自己显示。
      之前在表格外又放了一个 ElEmpty，结果「暂无数据」和
      「这个目录还是空的」同时出现在同一块区域里。
    -->

    <!-- 新建 / 重命名共用对话框 -->
    <ElDialog
      v-model="dialog"
      :title="dialogMode === 'create' ? '新建文件夹' : '重命名'"
      width="440px"
      :append-to-body="true"
    >
      <!--
        不要 label：对话框标题已说明操作（新建文件夹 / 重命名），
        再给表单加标签是同一句话写两遍。把含义放进 placeholder 即可。
      -->
      <ElInput
        v-model="dialogName"
        :placeholder="dialogMode === 'create' ? '请输入文件夹名称' : '请输入新名称'"
        @keyup.enter="submitDialog"
      />
      <template #footer>
        <ElButton @click="dialog = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitDialog">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Document, Folder } from '@element-plus/icons-vue'
  import {
    createMediaFolder,
    deleteMediaEntry,
    fetchMediaList,
    renameMediaEntry,
    type MediaEntry
  } from '@/api/xiaoya'

  const props = defineProps<{ root: string }>()

  const current = ref('')
  const parent = ref<string | null>(null)
  const items = ref<MediaEntry[]>([])
  const loading = ref(false)

  const dialog = ref(false)
  const dialogMode = ref<'create' | 'rename'>('create')
  const dialogName = ref('')
  const submitting = ref(false)
  const renaming = ref<MediaEntry | null>(null)

  /** ElTable 插槽行类型无法从泛型推导，这里显式收敛一次。 */
  function asEntry(row: unknown): MediaEntry {
    return row as MediaEntry
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

  function formatTime(value: string | null): string {
    if (!value) return '—'
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  }

  /** 加载目录内容；首次进入从授权根开始。 */
  async function load(path: string) {
    loading.value = true
    try {
      const res = await fetchMediaList(path)
      current.value = res.data.path
      parent.value = res.data.parent
      items.value = res.data.items
    } finally {
      loading.value = false
    }
  }

  function go(path: string | null) {
    if (path === null) return
    void load(path)
  }

  function openCreate() {
    dialogMode.value = 'create'
    dialogName.value = ''
    renaming.value = null
    dialog.value = true
  }

  function openRename(row: MediaEntry) {
    dialogMode.value = 'rename'
    dialogName.value = row.name
    renaming.value = row
    dialog.value = true
  }

  async function submitDialog() {
    const name = dialogName.value.trim()
    if (name === '') {
      ElMessage.warning('请输入名称')
      return
    }
    submitting.value = true
    try {
      if (dialogMode.value === 'create') {
        await createMediaFolder(current.value, name)
        ElMessage.success('已创建文件夹')
      } else if (renaming.value !== null) {
        const target = `${current.value.replace(/\/+$/, '')}/${name}`
        await renameMediaEntry(renaming.value.path, target)
        ElMessage.success('已重命名')
      }
      dialog.value = false
      await load(current.value)
    } finally {
      submitting.value = false
    }
  }

  async function remove(row: MediaEntry) {
    const extra = row.type === 'dir' ? '该文件夹内的所有内容都会一并删除。' : ''
    try {
      await ElMessageBox.confirm(`确定删除「${row.name}」？${extra}`, '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    await deleteMediaEntry(row.path)
    ElMessage.success('已删除')
    await load(current.value)
  }

  onMounted(() => {
    void load(props.root)
  })

  defineExpose({ reload: () => load(current.value || props.root) })
</script>

<style lang="scss" scoped>
  .browser {
    &__toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    &__nav,
    &__actions {
      display: flex;
      gap: 8px;
    }

    &__path {
      display: flex;
      gap: 8px;
      align-items: baseline;
      margin: 0 0 12px;
      font-size: 12px;
      word-break: break-all;

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--el-text-color-regular);
      }
    }

    &__path-label {
      flex-shrink: 0;
      color: var(--el-text-color-secondary);
    }

    &__name {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    &__link {
      color: var(--el-color-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
</style>
