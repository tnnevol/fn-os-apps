<!--
  可原位编辑的凭据单元格。

  交互：默认只读展示（表格预览态），双击进入编辑；Enter 确认、Esc 取消。
  长文本（Cookie / Open Token）用 textarea，Ctrl/Cmd+Enter 确认。

  为什么这么做而不是自己造控件：
  Element Plus 没有「可编辑单元格」这类组件，官方文档给的就是
  ElTable + ElInput 的条件渲染写法。这里把这段重复逻辑收成一个组件，
  内部全部使用 ElInput / ElButton / ElTag 的原生能力
  （show-password、autofocus、type=textarea、原生 keyup 事件），
  不自造输入框、不接管焦点逻辑。

  安全约定：密钥类字段进入编辑时输入框是空的。
  不回填已保存的明文，既避免在页面上暴露旧值，也符合「替换而非查看」的语义。
-->
<template>
  <div class="editable">
    <!-- 只读态：双击进入编辑 -->
    <div
      v-if="!editing"
      class="editable__view"
      :class="{ 'editable__view--empty': !displayText }"
      :title="`双击编辑：${label}`"
      @dblclick="beginEdit"
    >
      <span v-if="displayText" :class="{ editable__mono: mono }">{{ displayText }}</span>
      <ElTag v-else type="info" size="small">未配置</ElTag>
    </div>

    <!-- 编辑态 -->
    <div v-else class="editable__edit">
      <ElInput
        v-model="draft"
        :type="multiline ? 'textarea' : 'text'"
        :rows="multiline ? 3 : undefined"
        :autofocus="true"
        :show-password="secret && !multiline"
        :placeholder="placeholder"
        size="small"
        @keyup.enter="onEnter"
        @keyup.esc="cancel"
      />
      <div class="editable__actions">
        <ElButton size="small" type="primary" :loading="saving" @click="confirm">保存</ElButton>
        <ElButton size="small" text :disabled="saving" @click="cancel">取消</ElButton>
        <ElButton
          v-if="configured"
          size="small"
          text
          type="danger"
          :disabled="saving"
          @click="requestClear"
        >
          清除
        </ElButton>
      </div>
      <p v-if="multiline" class="editable__tip">Ctrl / Cmd + Enter 保存，Esc 取消</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'

  const props = withDefaults(
    defineProps<{
      /** 字段名，用于提示与错误信息 */
      label: string
      /** 已配置时展示的掩码文本；空串表示未配置 */
      masked?: string
      /** 是否已配置 */
      configured?: boolean
      /** 是否密钥类字段（决定是否用密码框、是否回填） */
      secret?: boolean
      /** 是否多行（Cookie、Open Token） */
      multiline?: boolean
      /** 等宽字体展示（Token、ID 一类） */
      mono?: boolean
      /** 输入提示 */
      placeholder?: string
      /** 非密钥字段的当前值，用于回填 */
      value?: string
      /** 提交新值；返回 Promise 以便失败时保持编辑态 */
      onSave?: (value: string) => Promise<void>
      /** 清除已保存的值 */
      onClear?: () => Promise<void>
    }>(),
    {
      masked: '',
      configured: false,
      secret: false,
      multiline: false,
      mono: true,
      placeholder: '',
      value: ''
    }
  )

  const editing = ref(false)
  const saving = ref(false)
  const draft = ref('')

  /** 只读态展示的文本。 */
  const displayText = computed(() => {
    if (props.configured) return props.masked !== '' ? props.masked : '已配置'
    // 非密钥字段即使未标记 configured 也直接展示值
    return props.value ?? ''
  })

  /** 进入编辑：密钥字段留空，非密钥字段回填当前值。 */
  function beginEdit() {
    editing.value = true
    draft.value = props.secret ? '' : (props.value ?? '')
  }

  /** 单行：Enter 保存；多行：只有 Ctrl/Cmd+Enter 才保存。 */
  function onEnter(event: KeyboardEvent) {
    if (props.multiline && !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    void confirm()
  }

  function cancel() {
    editing.value = false
    draft.value = ''
  }

  async function confirm() {
    const value = draft.value.trim()
    if (value === '') {
      // 空值不等同于「清除」：清除是独立的破坏性操作，需要单独确认
      ElMessage.warning(`请填写${props.label}`)
      return
    }
    saving.value = true
    try {
      if (props.onSave === undefined) throw new Error('缺少保存处理器')
      await props.onSave(value)
      ElMessage.success(`${props.label} 已保存`)
      editing.value = false
      draft.value = ''
      await nextTick()
    } catch {
      // 保存失败保持编辑态，避免用户输入被清掉
    } finally {
      saving.value = false
    }
  }

  async function requestClear() {
    saving.value = true
    try {
      if (props.onClear !== undefined) await props.onClear()
      editing.value = false
    } finally {
      saving.value = false
    }
  }

  // 外部值变化（例如扫码写入后刷新配置）时，退出编辑态展示最新掩码
  watch(
    () => props.masked,
    () => {
      if (saving.value) return
      editing.value = false
    }
  )
</script>

<style lang="scss" scoped>
  .editable {
    &__view {
      min-height: 24px;
      padding: 2px 4px;
      cursor: text;
      border-radius: 4px;
      transition: background 0.15s;

      &:hover {
        background: var(--el-fill-color-light);
      }

      &--empty {
        cursor: pointer;
      }
    }

    &__mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      word-break: break-all;
    }

    &__edit {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__actions {
      display: flex;
      gap: 4px;
    }

    &__tip {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
