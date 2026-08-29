import { useMemo, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import {
  DshButton,
  DshCascader,
  DshDropdown,
  DshIconButton,
  DshIconChevronDown,
  DshIconClose,
  DshIconFile,
  DshIconFolder,
  DshModal,
  DshTooltip,
  DshTree,
  DshTreeSelect,
} from '@tnnevol/dsh-semi-ui'
import type { ShowcaseRouteController } from './route.ts'
import { THEME_OPTIONS, type ShowcaseThemeController } from './theme-preview.ts'

const page: CSSProperties = { position: 'absolute', inset: 0, overflow: 'auto', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', padding: 28 }
const content: CSSProperties = { width: 'min(1100px, 100%)', margin: '0 auto' }
const header: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }
const panel: CSSProperties = { minWidth: 0, padding: 18, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12, background: 'var(--dsw-alias-bg-layer-2)' }
const demo: CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14 }
const themeMenu: CSSProperties = { display: 'grid', gap: 4, minWidth: 132, padding: 6 }
const themeOption: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, width: '100%', padding: '7px 9px', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }

const treeData = [{ label: '工作区', value: 'workspace', key: 'workspace', children: [{ label: '插件', value: 'plugins', key: 'plugins' }, { label: '应用', value: 'apps', key: 'apps' }] }]
const cascaderData = [{ label: '模型', value: 'model', children: [{ label: 'GPT-5.6 Luna', value: 'luna' }, { label: 'GPT-5.6 Sol', value: 'sol' }] }]

export function ShowcasePage({ route, theme }: { route: ShowcaseRouteController; theme: ShowcaseThemeController }) {
  const snapshot = useSyncExternalStore(route.subscribe, route.getSnapshot, route.getSnapshot)
  const themeSnapshot = useSyncExternalStore(theme.subscribe, theme.getSnapshot, theme.getSnapshot)
  const [modalVisible, setModalVisible] = useState(false)
  const [category, setCategory] = useState<'buttons' | 'selection' | 'tree' | 'modal'>('buttons')
  const selectedTheme = THEME_OPTIONS.find(option => option.id === themeSnapshot.preference) ?? THEME_OPTIONS[2]
  const dropdownContent = useMemo(() => <div style={{ padding: 10, minWidth: 140 }}>DSH 主题浮层</div>, [])
  const themeDropdownContent = useMemo(() => (
    <div style={themeMenu} role="menu" aria-label="主题模式">
      {THEME_OPTIONS.map(option => (
        <button
          key={option.id}
          type="button"
          role="menuitemradio"
          aria-checked={themeSnapshot.preference === option.id}
          style={themeOption}
          onClick={() => { theme.setPreference(option.id) }}
        >
          <span>{option.label}</span>
          {themeSnapshot.preference === option.id ? <span aria-hidden>✓</span> : null}
        </button>
      ))}
    </div>
  ), [theme, themeSnapshot.preference])
  if (!snapshot.active) return null

  return (
    <main style={page} data-dsh-semi-ui-showcase>
      <div style={content}>
        <header style={header}>
          <div><h1 style={{ margin: 0, fontSize: 24 }}>DSH Semi UI</h1><p style={{ margin: '6px 0 0', color: 'var(--dsw-alias-label-tertiary)' }}>共享组件与主题状态总览</p></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DshDropdown trigger="click" render={themeDropdownContent}>
              <DshButton theme="borderless" type="tertiary"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>主题：{selectedTheme?.label ?? '跟随系统'}<DshIconChevronDown aria-hidden /></span></DshButton>
            </DshDropdown>
            <DshIconButton aria-label="关闭总览" icon={<DshIconClose />} onClick={() => { route.close() }} />
          </div>
        </header>
        <nav aria-label="组件分类" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16 }}>
          {([['buttons', '按钮与浮层'], ['selection', '选择组件'], ['tree', 'Tree 与图标'], ['modal', 'Modal']] as const).map(([value, label]) => (
            <DshButton key={value} theme={category === value ? 'solid' : 'borderless'} type={category === value ? 'primary' : 'tertiary'} onClick={() => { setCategory(value) }}>{label}</DshButton>
          ))}
        </nav>
        <div style={grid}>
          {category === 'buttons' ? <section style={panel}><strong>按钮与浮层</strong><div style={demo}><DshButton theme="solid" type="primary">主要按钮</DshButton><DshButton>次要按钮</DshButton><DshButton loading>加载</DshButton><DshButton disabled>禁用</DshButton><DshTooltip content="共享 Tooltip"><DshButton>Tooltip</DshButton></DshTooltip><DshDropdown trigger="click" render={dropdownContent}><DshButton>Dropdown</DshButton></DshDropdown></div></section> : null}
          {category === 'selection' ? <section style={panel}><strong>选择组件</strong><div style={{ ...demo, alignItems: 'stretch', flexDirection: 'column' }}><DshCascader treeData={cascaderData} placeholder="级联选择" style={{ width: '100%' }} /><DshTreeSelect treeData={treeData} showLine={false} placeholder="树选择" style={{ width: '100%' }} /></div></section> : null}
          {category === 'tree' ? <section style={panel}><strong>Tree 与图标</strong><div style={demo}><DshIconFolder /><DshIconFile /></div><DshTree treeData={treeData} defaultExpandAll /></section> : null}
          {category === 'modal' ? <section style={panel}><strong>Modal</strong><div style={demo}><DshButton onClick={() => { setModalVisible(true) }}>打开 Modal</DshButton></div><DshModal title="DSH Semi UI" visible={modalVisible} onCancel={() => { setModalVisible(false) }} onOk={() => { setModalVisible(false) }}>Modal 使用统一的 DSH 主题 Token。</DshModal></section> : null}
        </div>
      </div>
    </main>
  )
}
