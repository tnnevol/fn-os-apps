// 树形与快捷键类组件 demo：Tree、Icon、HotKeys。
import type { ComponentType, ReactNode } from 'react'
import {
  DshButton,
  DshHotKeys,
  DshIconFile,
  DshIconFolder,
  DshIconFolderOpen,
  DshIconRefresh,
  DshIconRestart,
  DshIconSetting,
  DshInput,
  DshModal,
  DshSemiIcons,
  DshTree,
} from '@tnnevol/dsh-semi-ui'
import { useRef, useState } from 'react'
import { demo, demoBlock, demoLabel, iconGrid, iconTile, iconTileLabel, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import { disabledTreeData, iconModes, treeData } from '../demo-data.ts'

type ShowcaseIcon = ComponentType<{ 'aria-label'?: string; size?: 'inherit' | 'extra-small' | 'small' | 'default' | 'large' | 'extra-large'; fill?: string[] }>
const iconCatalog = Object.entries(DshSemiIcons)
  .filter(([name, icon]) => name !== 'Icon' && /^Icon[A-Z]/.test(name) && (typeof icon === 'function' || typeof icon === 'object'))
  .map(([name, icon]) => ({
    name,
    group: name.startsWith('IconAI') ? 'ai' : name.endsWith('Stroked') ? 'stroked' : 'filled',
    Icon: icon as ShowcaseIcon,
  }))

export function TreeSection(): ReactNode {
  return (
    <>
      <h2 id="tree-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>展示基本用法、多选、搜索、整行高亮、选中、半选和禁用状态。</p>
      <DemoCard source={'<DshTree treeData={treeData} defaultExpandAll />\n<DshTree treeData={treeData} multiple filterTreeNode />'}><div className={stack}><div className={demoBlock}><span className={demoLabel}>基本用法与整行高亮</span><DshTree treeData={treeData} defaultExpandAll className="dsh-semi-showcase-tree" /></div><div className={demoBlock}><span className={demoLabel}>复选与半选状态</span><DshTree treeData={treeData} multiple defaultValue={['plugins']} defaultExpandAll showLine blockNode className="dsh-semi-showcase-tree" aria-label="Tree 复选示例" /></div><div className={demoBlock}><span className={demoLabel}>搜索与标签高亮</span><DshTree treeData={treeData} multiple filterTreeNode defaultExpandAll blockNode className="dsh-semi-showcase-tree" aria-label="Tree 搜索示例" /></div><div className={demoBlock}><span className={demoLabel}>选中与禁用状态</span><DshTree treeData={disabledTreeData} defaultValue="plugins" defaultExpandAll blockNode className="dsh-semi-showcase-tree" aria-label="Tree 选中示例" /></div></div></DemoCard>
    </>
  )
}

export function IconSection(): ReactNode {
  const [iconMode, setIconMode] = useState<'all' | 'filled' | 'stroked' | 'ai'>('all')
  return (
    <>
      <h2 id="tree-icons" className={sectionTitle}>图标列表</h2>
      <p className={sectionText}>与 Semi 官方 Icon 文档一致，完整展示 `@douyinfe/semi-icons` 的面性、线性和 AI 图标，并按图标类型筛选。</p>
      <DemoCard source={'import * as Icons from \'@douyinfe/semi-icons\'\n\n<IconHome size="large" />'}><div className={stack}><div className={demo}>{iconModes.map(([mode, label]) => <DshButton key={mode} type={iconMode === mode ? 'primary' : 'secondary'} theme={iconMode === mode ? 'solid' : 'light'} size="small" onClick={() => { setIconMode(mode) }}>{label}</DshButton>)}</div><div className={iconGrid}>{iconCatalog.filter(icon => iconMode === 'all' || icon.group === iconMode).map(({ name, Icon }) => <div key={name} className={iconTile}><Icon aria-label={name} size="large" /><span className={iconTileLabel} title={name}>{name}</span></div>)}</div></div></DemoCard>
      <h2 id="tree-icons-basic" className={sectionTitle}>基础使用</h2>
      <p className={sectionText}>图标颜色继承 DSH 的文本和状态变量，名称与官方 Icon 组件保持一致。</p>
      <DemoCard source={'<DshIconFolder /> <DshIconFolderOpen />\n<DshIconFile /> <DshIconSetting />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-icon-row dsh-semi-showcase-icon-row--small"><DshIconFolder aria-label="文件夹" /><DshIconFolderOpen aria-label="打开的文件夹" /><DshIconFile aria-label="文件" /><DshIconSetting aria-label="设置" /><DshIconRefresh aria-label="刷新" /><DshIconRestart aria-label="重启" /></div></DemoCard>
      <h2 id="tree-icons-states" className={sectionTitle}>尺寸与状态</h2>
      <p className={sectionText}>按照官方文档展示尺寸、旋转和加载状态。</p>
      <DemoCard source={'<DshIconRefresh size="extra-small" />\n<DshIconRefresh rotate={180} />\n<DshIconRefresh spin />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-icon-row dsh-semi-showcase-icon-row--small"><DshIconRefresh size="extra-small" aria-label="超小" /><DshIconRefresh size="small" aria-label="小" /><DshIconRefresh size="default" aria-label="默认" /><DshIconRefresh size="large" aria-label="大" /><DshIconRefresh size="extra-large" aria-label="超大" /><DshIconRefresh rotate={180} aria-label="旋转" /><DshIconRefresh spin aria-label="加载" /></div></DemoCard>
      <h2 id="tree-icons-colors" className={sectionTitle}>颜色与双色图标</h2>
      <p className={sectionText}>颜色由组件属性控制，双色图标与多色按钮不再依赖主题里的固定颜色。</p>
      <DemoCard source={'<IconHome fill={[primaryColor]} />\n<IconHome fill={[primaryColor, secondaryColor]} />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-icon-row dsh-semi-showcase-icon-row--large"><DshIconFolder fill={['var(--dsw-alias-primary)']} aria-label="主题色" /><DshIconFolder fill={['var(--dsw-alias-success)']} aria-label="成功色" /><DshIconFolder fill={['var(--dsw-alias-warning)']} aria-label="警告色" /><DshIconFolderOpen fill={['var(--dsw-alias-primary)', 'var(--dsw-alias-label-secondary)']} aria-label="双色图标" /><DshIconSetting fill={['var(--dsw-alias-danger)', 'var(--dsw-alias-label-secondary)']} aria-label="双色设置" /></div></DemoCard>
    </>
  )
}

export function HotKeysSection(): ReactNode {
  const [hotKeysModalVisible, setHotKeysModalVisible] = useState(false)
  const [hotKeysEvent, setHotKeysEvent] = useState('尚未触发快捷键')
  // HotKeys 的自定义监听挂载点：指向下方演示容器，避免全局快捷键干扰其它示例。
  const hotKeysTargetRef = useRef<HTMLDivElement | null>(null)
  const showHotKeysModal = (): void => { setHotKeysModalVisible(true) }
  return (
    <>
      <h2 id="hotkeys-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>通过 `hotKeys` 传入快捷键组合（可使用 `HotKeys.Keys`），`onHotKey` 为触发回调；默认监听 document，全局生效。按下 Ctrl + Shift + A 试试。</p>
      <DemoCard source={'const [visible, setVisible] = useState(false)\nconst hotKeys = [DshHotKeys.Keys.Control, "Shift", DshHotKeys.Keys.A]\n<DshHotKeys hotKeys={hotKeys} onHotKey={() => setVisible(true)} />\n<DshModal title="快捷键弹窗" visible={visible} onOk={close} onCancel={close}>\n  This is the Modal opened by hotkey: {hotKeys.join("+")}.\n</DshModal>'}>
        <div className={demo}>
          <DshHotKeys hotKeys={[DshHotKeys.Keys.Control, 'Shift', DshHotKeys.Keys.A]} onHotKey={showHotKeysModal} />
          <DshButton type="secondary" theme="light">按下 Ctrl + Shift + A</DshButton>
          <DshModal title="快捷键弹窗" visible={hotKeysModalVisible} closeOnEsc okText="确定" cancelText="取消" onCancel={() => { setHotKeysModalVisible(false) }} onOk={() => { setHotKeysModalVisible(false) }}>
            <p>这是由快捷键 Ctrl + Shift + A 触发的 Modal。</p>
          </DshModal>
        </div>
      </DemoCard>
      <h2 id="hotkeys-prevent" className={sectionTitle}>阻止默认事件与自定义渲染</h2>
      <p className={sectionText}>`preventDefault` 阻止浏览器默认行为；`render` 自定义渲染内容，`content` 提供无 UI 的提示文案，`getListenerTarget` 更换监听挂载 DOM。</p>
      <DemoCard source={'<DshHotKeys\n  hotKeys={["s"]}\n  preventDefault\n  getListenerTarget={() => targetRef.current}\n  onHotKey={handleSave}\n  content={["按下 S 保存"]}\n/>'}>
        <div ref={hotKeysTargetRef} className="dsh-semi-showcase-hotkeys-target" tabIndex={-1}>
          <DshHotKeys hotKeys={['s']} preventDefault getListenerTarget={() => (hotKeysTargetRef.current ?? undefined) as HTMLElement} onHotKey={() => { setHotKeysEvent('已触发保存快捷键（s）') }} content={['按下 S 保存']} />
          <DshInput placeholder="聚焦后按下 s 触发快捷键" onChange={() => {}} showClear />
          <span className="dsh-semi-showcase-event-status" role="status">{hotKeysEvent}</span>
        </div>
      </DemoCard>
    </>
  )
}
