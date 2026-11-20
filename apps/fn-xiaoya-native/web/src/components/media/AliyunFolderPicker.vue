<!--
  阿里云盘目录选择器。

  转存目录的 folder id 原本要用户手工粘贴 40 位十六进制串，既难获取又易抄错。
  这里直接列出网盘目录让用户点选，选中即得到 file_id。

  只列目录、不列文件：目标是选「转存目录」，混着文件会让列表很长且无法选取。
-->
<template>
  <div class="folder-picker">
    <div class="folder-picker__bar">
      <ElButton size="small" :disabled="path.length === 0" @click="goUp">上一级</ElButton>
      <span class="folder-picker__path">
        <code>{{ breadcrumb }}</code>
      </span>
      <ElButton size="small" :loading="loading" @click="reload">刷新</ElButton>
      <ElButton size="small" type="primary" plain @click="createVisible = true">
        新建文件夹
      </ElButton>
    </div>

    <div
      v-loading="loading"
      class="folder-picker__list"
      :class="{ 'folder-picker__list--scroll': items.length > 0 }"
    >
      <div v-for="item in items" :key="item.id" class="folder-picker__item" @click="enter(item)">
        <ElIcon><Folder /></ElIcon>
        <span class="folder-picker__name">{{ item.name }}</span>
        <ElButton size="small" text type="primary" @click.stop="choose(item)">选择</ElButton>
      </div>
      <ElEmpty
        v-if="!loading && items.length === 0"
        :description="path.length === 0 ? '网盘根目录下没有文件夹' : '这个目录下没有子文件夹'"
      />
    </div>

    <p class="folder-picker__hint">
      当前路径对应的 ID：<code>{{ currentId }}</code>
      <ElButton link type="primary" size="small" @click="chooseCurrent">用这个目录</ElButton>
    </p>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Folder } from '@element-plus/icons-vue'
  import { createAliyunFolder, fetchAliyunFolders, type AliyunFolder } from '@/api/xiaoya'

  const emit = defineEmits<{ picked: [id: string, name: string] }>()

  /** 当前浏览路径（从根到当前），用于面包屑与返回上一级 */
  const path = ref<Array<{ id: string; name: string }>>([])
  const items = ref<AliyunFolder[]>([])
  const loading = ref(false)
  const createVisible = ref(false)
  const creating = ref(false)
  const newName = ref('')

  const currentId = computed(() => path.value[path.value.length - 1]?.id ?? 'root')
  const breadcrumb = computed(() =>
    path.value.length === 0 ? '根目录' : `根目录 / ${path.value.map((p) => p.name).join(' / ')}`
  )

  /** 加载当前目录的子目录。 */
  async function load() {
    loading.value = true
    try {
      const res = await fetchAliyunFolders(currentId.value)
      items.value = res.data.items
    } catch {
      // 错误提示由 HTTP 层统一弹出（含后端的处理建议），这里只清理状态
      items.value = []
    } finally {
      loading.value = false
    }
  }

  /** 进入某个子目录。 */
  function enter(item: AliyunFolder) {
    path.value = [...path.value, { id: item.id, name: item.name }]
    void load()
  }

  /** 返回上一级。 */
  function goUp() {
    path.value = path.value.slice(0, -1)
    void load()
  }

  /** 选中某个子目录。 */
  function choose(item: AliyunFolder) {
    emit('picked', item.id, item.name)
  }

  /** 选中当前所在目录。 */
  function chooseCurrent() {
    const current = path.value[path.value.length - 1]
    emit('picked', currentId.value, current?.name ?? '根目录')
  }

  /** 在当前目录下新建文件夹，成功后刷新列表。 */
  async function submitCreate() {
    const name = newName.value.trim()
    if (name === '') {
      ElMessage.warning('请输入文件夹名称')
      return
    }
    creating.value = true
    try {
      await createAliyunFolder(currentId.value, name)
      ElMessage.success('文件夹已创建')
      createVisible.value = false
      newName.value = ''
      await load()
    } catch {
      // 错误提示由 HTTP 层统一弹出
    } finally {
      creating.value = false
    }
  }

  function reload() {
    void load()
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .folder-picker {
    &__bar {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
    }

    &__path {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      code {
        word-break: break-all;
      }
    }

    // 只有真正有列表项时才限制高度并滚动；空状态若也套 overflow:auto，
    // ElEmpty 的插画会把容器撑出竖向滚动条，看起来像内容被截断。
    &__list {
      min-height: 120px;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;

      &--scroll {
        max-height: 320px;
        overflow-y: auto;
      }
    }

    &__item {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--el-fill-color-light);
      }
    }

    &__name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__hint {
      margin: 10px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
    }
  }
</style>
