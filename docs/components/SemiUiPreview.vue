<script setup lang="ts">
import { computed, ref } from 'vue'

type Category = 'buttons' | 'selection' | 'tree' | 'feedback' | 'modal'

const category = ref<Category>('buttons')
const previewTheme = ref<'light' | 'dark'>('light')
const dropdownOpen = ref(false)
const cascaderOpen = ref(false)
const treeSelectOpen = ref(false)
const modalOpen = ref(false)
const toastVisible = ref(false)
const selectedTree = ref<string[]>(['plugins'])
const selectedCascader = ref('GPT-5.6 Luna')
const selectedTreeSelect = ref('插件')

const categories: Array<[Category, string]> = [
  ['buttons', '按钮与浮层'],
  ['selection', '选择组件'],
  ['tree', 'Tree 与图标'],
  ['modal', 'Modal'],
]

const buttonTypes = [
  ['primary', '主要'],
  ['secondary', '次要'],
  ['tertiary', '第三'],
  ['warning', '警告'],
  ['danger', '危险'],
]

const buttonThemes = ['solid', 'light', 'outline', 'borderless']
const buttonSizes = ['large', 'default', 'small']
const cascaderOptions = ['GPT-5.6 Luna', 'GPT-5.6 Sol', 'GPT-5.6 Terra']
const treeNodes = [
  { value: 'plugins', label: '插件', icon: '▰' },
  { value: 'apps', label: '应用', icon: '▰' },
  { value: 'docs', label: '文档', icon: '▰' },
]

const previewClass = computed(() => ({ 'is-dark': previewTheme.value === 'dark' }))

function toggleTree(value: string): void {
  selectedTree.value = selectedTree.value.includes(value)
    ? selectedTree.value.filter(item => item !== value)
    : [...selectedTree.value, value]
}
</script>

<template>
  <div class="semi-preview" :class="previewClass">
    <div class="semi-preview__hero">
      <div>
        <span class="semi-doc-breadcrumb">基础类 <span>›</span> 组件总览</span>
        <span class="semi-preview__eyebrow">SHARED COMPONENT SYSTEM</span>
        <h2>Semi UI 组件总览</h2>
        <p>基于 Semi Design 组件语义，统一展示 DSH 主题下的组件类型、状态和交互。</p>
      </div>
      <div class="semi-preview__theme" role="group" aria-label="预览主题">
        <button type="button" :class="{ active: previewTheme === 'light' }" @click="previewTheme = 'light'">亮色</button>
        <button type="button" :class="{ active: previewTheme === 'dark' }" @click="previewTheme = 'dark'">暗色</button>
      </div>
    </div>

    <div class="semi-preview__layout">
      <aside class="semi-preview__nav" aria-label="组件分类">
        <span class="semi-preview__nav-title">基础类</span>
        <button v-for="item in categories" :key="item[0]" type="button" :class="{ active: category === item[0] }" @click="category = item[0]">
          <span class="semi-preview__nav-dot"></span>{{ item[1] }}
        </button>
        <span class="semi-preview__nav-title semi-preview__nav-title--group">输入类</span>
        <button type="button" :class="{ active: category === 'selection' }" @click="category = 'selection'">Cascader 级联选择</button>
        <button type="button" :class="{ active: category === 'selection' }" @click="category = 'selection'">TreeSelect 树选择器</button>
        <span class="semi-preview__nav-title semi-preview__nav-title--group">导航类</span>
        <button type="button" :class="{ active: category === 'tree' }" @click="category = 'tree'">Tree 树形控件</button>
        <span class="semi-preview__nav-title semi-preview__nav-title--group">反馈类</span>
        <button type="button" :class="{ active: category === 'feedback' }" @click="category = 'feedback'">Progress / Spin / Toast</button>
      </aside>

      <div class="semi-preview__content">
        <section v-if="category === 'buttons'" class="semi-preview__section">
          <span class="semi-preview__eyebrow">BUTTON</span>
          <h3>按钮</h3>
          <p>按钮拥有明确的层级、主题和状态，主次操作保持视觉区分。</p>

          <div class="semi-doc-example-note">代码示例</div>
          <pre class="semi-doc-code"><code>import { Button } from '@tnnevol/dsh-semi-ui'

&lt;Button type="primary" theme="solid"&gt;主要按钮&lt;/Button&gt;</code></pre>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">按钮类型</span>
            <div class="semi-preview__row">
              <button v-for="item in buttonTypes" :key="item[0]" type="button" class="semi-button is-solid" :class="`is-${item[0]}`">{{ item[1] }}</button>
            </div>
          </div>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">按钮主题</span>
            <div class="semi-preview__row">
              <button v-for="item in buttonThemes" :key="item" type="button" class="semi-button is-primary" :class="`is-${item}`">{{ item }}</button>
            </div>
          </div>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">按钮尺寸</span>
            <div class="semi-preview__row">
              <button v-for="item in buttonSizes" :key="item" type="button" class="semi-button is-secondary is-solid" :class="`is-size-${item}`">{{ item }}</button>
            </div>
          </div>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">状态</span>
            <div class="semi-preview__row">
              <button type="button" class="semi-button is-primary is-solid is-loading"><span class="semi-spinner"></span>加载中</button>
              <button type="button" class="semi-button is-secondary is-solid" disabled>禁用</button>
              <button type="button" class="semi-button is-danger is-outline" disabled>禁用描边</button>
              <button type="button" class="semi-button is-primary is-solid semi-button--wide">块级按钮</button>
            </div>
          </div>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">图标与组合</span>
            <div class="semi-preview__row">
              <button type="button" class="semi-button is-primary is-solid"><span class="semi-icon">⚙</span>设置</button>
              <button type="button" class="semi-button is-secondary is-light">刷新 <span class="semi-icon">↻</span></button>
              <button type="button" class="semi-icon-button is-primary is-solid" aria-label="设置">⚙</button>
              <div class="semi-button-group" role="group" aria-label="操作按钮组"><button type="button">保存</button><button type="button">继续</button><button type="button">更多</button></div>
            </div>
          </div>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">Tooltip 与 Dropdown</span>
            <div class="semi-preview__row">
              <span class="semi-tooltip-demo"><button type="button" class="semi-button is-secondary is-light">Tooltip</button><span class="semi-tooltip">共享 Tooltip</span></span>
              <span class="semi-dropdown-demo"><button type="button" class="semi-button is-secondary is-light" @click="dropdownOpen = !dropdownOpen">Dropdown <span class="semi-icon">⌄</span></button><span v-if="dropdownOpen" class="semi-dropdown-menu"><button type="button" @click="dropdownOpen = false">编辑</button><button type="button" @click="dropdownOpen = false">复制</button><button type="button" @click="dropdownOpen = false">删除</button></span></span>
            </div>
          </div>
        </section>

        <section v-else-if="category === 'selection'" class="semi-preview__section">
          <span class="semi-preview__eyebrow">SELECTION</span>
          <h3>选择组件</h3>
          <p>覆盖默认、已选择、多选、禁用和校验状态。</p>

          <div class="semi-doc-example-note">代码示例</div>
          <pre class="semi-doc-code"><code>import { DshCascader, DshTreeSelect } from '@tnnevol/dsh-semi-ui'

&lt;DshTreeSelect multiple treeCheckable checkRelation="related" /&gt;</code></pre>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">Cascader 级联选择</span>
            <div class="semi-preview__row">
              <span class="semi-select-demo"><button type="button" class="semi-select" @click="cascaderOpen = !cascaderOpen">{{ selectedCascader }} <span>⌄</span></button><span v-if="cascaderOpen" class="semi-selection-menu"><button v-for="option in cascaderOptions" :key="option" type="button" @click="selectedCascader = option; cascaderOpen = false">{{ option }}<span v-if="selectedCascader === option">✓</span></button></span></span>
              <button type="button" class="semi-select" disabled>禁用 <span>⌄</span></button>
              <button type="button" class="semi-select is-error">错误状态 <span>⌄</span></button>
            </div>
          </div>

          <div class="semi-preview__demo-group">
            <span class="semi-preview__label">TreeSelect 树选择</span>
            <div class="semi-preview__row">
              <span class="semi-select-demo"><button type="button" class="semi-select" @click="treeSelectOpen = !treeSelectOpen">{{ selectedTreeSelect }} <span>⌄</span></button><span v-if="treeSelectOpen" class="semi-selection-menu"><button v-for="node in treeNodes" :key="node.value" type="button" @click="selectedTreeSelect = node.label; treeSelectOpen = false"><span>{{ node.icon }}</span>{{ node.label }}<span v-if="selectedTreeSelect === node.label">✓</span></button></span></span>
              <button type="button" class="semi-select">多选 <span class="semi-tag">插件</span><span class="semi-tag">应用</span><span>⌄</span></button>
              <button type="button" class="semi-select is-success">成功状态 <span>⌄</span></button>
            </div>
          </div>
        </section>

        <section v-else-if="category === 'tree'" class="semi-preview__section">
          <span class="semi-preview__eyebrow">TREE &amp; ICON</span>
          <h3>Tree 与图标</h3>
          <p>检查展开、选中、复选、半选和共享图标的显示效果。</p>
          <div class="semi-doc-example-note">代码示例</div>
          <pre class="semi-doc-code"><code>import { DshTree } from '@tnnevol/dsh-semi-ui'

&lt;DshTree treeData={treeData} defaultExpandAll showLine /&gt;</code></pre>
          <div class="semi-tree-demo">
            <div class="semi-tree-row semi-tree-row--root"><span>⌄</span><span class="semi-checkbox is-indeterminate">−</span><span class="semi-folder">▰</span><strong>工作区</strong></div>
            <div v-for="node in treeNodes" :key="node.value" class="semi-tree-row"><span class="semi-tree-indent">›</span><button type="button" class="semi-checkbox" :class="{ checked: selectedTree.includes(node.value) }" @click="toggleTree(node.value)">{{ selectedTree.includes(node.value) ? '✓' : '' }}</button><span class="semi-folder">{{ node.icon }}</span><span>{{ node.label }}</span></div>
          </div>
          <div class="semi-preview__demo-group"><span class="semi-preview__label">共享图标</span><div class="semi-icon-grid"><span><b>▰</b>文件夹</span><span><b>▱</b>打开文件夹</span><span><b>▤</b>文件</span><span><b>⚙</b>设置</span><span><b>↻</b>刷新</span><span><b>↗</b>重启</span></div></div>
        </section>

        <section v-else-if="category === 'feedback'" class="semi-preview__section">
          <span class="semi-preview__eyebrow">FEEDBACK</span>
          <h3>反馈组件</h3>
          <p>Progress、Spin 和 Toast 的常用状态与官方文档保持一致。</p>
          <div class="semi-doc-example-note">Progress 进度条</div>
          <div class="semi-feedback-progress"><span style="width: 25%"></span></div>
          <div class="semi-feedback-progress"><span class="is-success" style="width: 68%"></span></div>
          <div class="semi-feedback-progress is-large"><span class="is-warning" style="width: 88%"></span></div>
          <div class="semi-doc-example-note">Spin 加载器</div>
          <div class="semi-preview__row"><span class="semi-spinner"></span><span class="semi-spinner semi-spinner--large"></span><span class="semi-preview__label">加载中</span></div>
          <div class="semi-doc-example-note">Toast 提示</div>
          <div class="semi-preview__row"><button type="button" class="semi-button is-secondary is-light" @click="toastVisible = true">显示 Toast</button><div v-if="toastVisible" class="semi-feedback-toast" role="alert">操作已完成 <button type="button" aria-label="关闭 Toast" @click="toastVisible = false">×</button></div></div>
        </section>

        <section v-else class="semi-preview__section">
          <span class="semi-preview__eyebrow">MODAL</span>
          <h3>Modal 对话框</h3>
          <p>保留标题、内容、取消、确认和遮罩交互。</p>
          <div class="semi-doc-example-note">代码示例</div>
          <pre class="semi-doc-code"><code>import { DshModal } from '@tnnevol/dsh-semi-ui'

&lt;DshModal title="确认操作" visible={visible} /&gt;</code></pre>
          <button type="button" class="semi-button is-primary is-solid" @click="modalOpen = true">打开 Modal</button>
          <div v-if="modalOpen" class="semi-modal-mask" @click.self="modalOpen = false"><div class="semi-modal" role="dialog" aria-modal="true" aria-label="DSH Semi UI"><div class="semi-modal__heading"><strong>DSH Semi UI</strong><button type="button" aria-label="关闭" @click="modalOpen = false">×</button></div><p>Modal 使用统一的 DSH 主题 Token。</p><div class="semi-modal__actions"><button type="button" class="semi-button is-secondary is-light" @click="modalOpen = false">取消</button><button type="button" class="semi-button is-primary is-solid" @click="modalOpen = false">确认</button></div></div></div>
        </section>
      </div>
      <aside class="semi-preview__outline" aria-label="当前组件目录">
        <span>如何引入</span>
        <span>基本用法</span>
        <span>类型与主题</span>
        <span>尺寸</span>
        <span>禁用状态</span>
        <span>交互状态</span>
        <span>API 参考</span>
      </aside>
    </div>
  </div>
</template>
