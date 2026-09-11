// 基础与浮层类组件 demo：Button、Tooltip、Dropdown、Popover。
import { useMemo } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  DshButton,
  DshButtonGroup,
  DshDropdown,
  DshIconAlertCircle,
  DshIconChevronDown,
  DshIconClose,
  DshIconFile,
  DshIconFolder,
  DshIconFolderOpen,
  DshIconRefresh,
  DshIconSetting,
  DshIconButton,
  DshPopover,
  DshTooltip,
} from '@tnnevol/dsh-semi-ui'
import { useState } from 'react'
import { demo, demoBlock, demoLabel, dropdownApiCell, dropdownApiTable, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import { buttonSizes, buttonThemes, buttonTypes } from '../demo-data.ts'

/** 按钮类型、主题、尺寸与状态。 */
export function ButtonSection(): ReactNode {
  const [buttonLoading, setButtonLoading] = useState(false)
  return (
    <>
      <h2 id="how-to" className={sectionTitle}>如何引入</h2>
      <DemoCard source={"import { Button } from '@tnnevol/dsh-semi-ui'\n\n<DshButton type=\"primary\">主要按钮</DshButton>"}><DshButton type="primary" theme="solid">主要按钮</DshButton></DemoCard>
      <h2 id="button-types" className={sectionTitle}>按钮类型</h2>
      <p className={sectionText}>按钮类型用于表达操作的重要程度。</p>
      <DemoCard source={'<DshButton type="primary">主要</DshButton>\n<DshButton type="secondary">次要</DshButton>\n<DshButton type="warning">警告</DshButton>'}><div className={demo}>{buttonTypes.map(([type, label]) => <DshButton key={type} type={type} theme="solid">{label}</DshButton>)}</div></DemoCard>
      <h2 id="button-theme" className={sectionTitle}>按钮主题与尺寸</h2>
      <p className={sectionText}>主题控制按钮的视觉层级，尺寸适用于不同密度的页面。</p>
      <DemoCard source={'type: primary | secondary | tertiary | warning | danger\ntheme: solid | light | outline | borderless'}><div className={stack}>{buttonThemes.map(themeName => <div key={themeName} className={demoBlock}><span className={demoLabel}>{themeName}</span><div className={demo}>{buttonTypes.map(([type, label]) => <DshButton key={`${themeName}-${type}`} type={type} theme={themeName} size="small">{label}</DshButton>)}</div></div>)}<div className={demo}><span className={demoLabel}>size</span>{buttonSizes.map(size => <DshButton key={size} type="secondary" theme="light" size={size}>{size}</DshButton>)}</div></div></DemoCard>
      <h2 id="button-states" className={sectionTitle}>按钮状态</h2>
      <p className={sectionText}>加载、禁用、块级和图标按钮均使用共享主题 Token。</p>
      <DemoCard source={'<DshButton loading={loading}>保存</DshButton>\n<DshButton disabled>禁用</DshButton>\n<DshButton icon={<DshIconSetting />}>设置</DshButton>'}><div className={stack}><div className={demo}><DshButton type="primary" theme="solid" loading={buttonLoading}>保存</DshButton><DshButton type="secondary" theme="light" onClick={() => { setButtonLoading(value => !value) }}>{buttonLoading ? '关闭加载态' : '开启加载态'}</DshButton><DshButton type="secondary" theme="solid" disabled>禁用</DshButton><DshButton type="danger" theme="outline" disabled>禁用描边</DshButton><DshButton type="primary" theme="solid" block className="dsh-semi-showcase-block-button">块级按钮</DshButton></div><div className={demo}><DshButton type="primary" theme="solid" icon={<DshIconSetting />}>设置</DshButton><DshButton type="secondary" theme="light" icon={<DshIconRefresh />} iconPosition="right">刷新</DshButton><DshIconButton type="primary" theme="solid" icon={<DshIconSetting />} aria-label="设置" /><DshIconButton type="secondary" theme="light" icon={<DshIconClose />} aria-label="关闭" disabled /></div></div></DemoCard>
      <h2 id="button-overlays" className={sectionTitle}>按钮组合与浮层</h2>
      <DemoCard source={'<DshButtonGroup>...</DshButtonGroup>\n<DshTooltip content="提示">...</DshTooltip>\n<DshDropdown trigger="click">...</DshDropdown>'}><div className={demo}><DshButtonGroup type="primary" theme="solid" aria-label="操作按钮组"><DshButton>保存</DshButton><DshButton>继续</DshButton><DshButton>更多</DshButton></DshButtonGroup><DshButtonGroup type="secondary" theme="light" size="small" aria-label="辅助操作按钮组"><DshButton>上一项</DshButton><DshButton>下一项</DshButton></DshButtonGroup><DshTooltip content="Tooltip 默认浮层，鼠标悬停查看"><DshButton type="secondary" theme="light">Tooltip</DshButton></DshTooltip></div></DemoCard>
    </>
  )
}

/** 文字提示。 */
export function TooltipSection(): ReactNode {
  return (
    <>
      <h2 id="tooltip-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>鼠标悬停查看提示，并使用 DSH 的浮层背景与文字变量。</p>
      <DemoCard source={'<DshTooltip content="Tooltip 默认浮层">\n  <DshButton>悬停查看</DshButton>\n</DshTooltip>'}><DshTooltip content="Tooltip 默认浮层，鼠标悬停查看"><DshButton type="secondary" theme="light">悬停查看</DshButton></DshTooltip></DemoCard>
    </>
  )
}

/** 下拉框：基本用法、嵌套、位置、触发方式、事件与 JSON 菜单。 */
export function DropdownSection(): ReactNode {
  const [dropdownSelected, setDropdownSelected] = useState('插件')
  const [dropdownEvent, setDropdownEvent] = useState('等待菜单操作')
  const [dropdownCustomVisible, setDropdownCustomVisible] = useState(false)
  const dropdownMenu = useMemo(() => (
    <DshDropdown.Menu>
      <DshDropdown.Title>工作区</DshDropdown.Title>
      <DshDropdown.Item icon={<DshIconFolderOpen />} active={dropdownSelected === '插件'} onClick={() => { setDropdownSelected('插件'); setDropdownEvent('已选择：插件') }}>插件</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconFile />} active={dropdownSelected === '文档'} onClick={() => { setDropdownSelected('文档'); setDropdownEvent('已选择：文档') }}>文档</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconFolder />} disabled>应用（禁用）</DshDropdown.Item>
      <DshDropdown.Divider />
      <DshDropdown.Title>操作</DshDropdown.Title>
      <DshDropdown.Item icon={<DshIconSetting />} type="primary" onClick={() => { setDropdownEvent('已打开设置') }}>设置</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconRefresh />} type="warning" onClick={() => { setDropdownEvent('已刷新工作区') }}>刷新工作区</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconAlertCircle />} type="danger" onClick={() => { setDropdownEvent('已执行危险操作') }}>删除缓存</DshDropdown.Item>
    </DshDropdown.Menu>
  ), [dropdownSelected])
  const nestedDropdownMenu = useMemo(() => (
    <DshDropdown.Menu>
      <DshDropdown.Item>当前会话</DshDropdown.Item>
      <DshDropdown.Item>全部会话</DshDropdown.Item>
      <DshDropdown.Item disabled>已归档会话</DshDropdown.Item>
    </DshDropdown.Menu>
  ), [])
  const dropdownEventMenu = useMemo(() => (
    <DshDropdown.Menu>
      <DshDropdown.Item onClick={() => { setDropdownEvent('onClick：选择了菜单项') }}>点击事件</DshDropdown.Item>
      <DshDropdown.Item onMouseEnter={() => { setDropdownEvent('onMouseEnter：指针进入菜单项') }}>移入事件</DshDropdown.Item>
      <DshDropdown.Item onMouseLeave={() => { setDropdownEvent('onMouseLeave：指针离开菜单项') }}>移出事件</DshDropdown.Item>
      <DshDropdown.Item onContextMenu={(event: MouseEvent<HTMLLIElement>) => { event.preventDefault(); setDropdownEvent('onContextMenu：右键菜单项') }}>右键事件</DshDropdown.Item>
    </DshDropdown.Menu>
  ), [])
  const dropdownJsonMenu = [
    { node: 'title', name: '快捷操作' },
    { node: 'item', name: '新建文件', type: 'primary', active: true, icon: <DshIconFile />, onClick: () => { setDropdownEvent('JSON 菜单：新建文件') } },
    { node: 'item', name: '打开目录', type: 'secondary', icon: <DshIconFolderOpen />, onClick: () => { setDropdownEvent('JSON 菜单：打开目录') } },
    { node: 'divider' },
    { node: 'item', name: '清理缓存', type: 'danger', icon: <DshIconAlertCircle />, onClick: () => { setDropdownEvent('JSON 菜单：清理缓存') } },
  ]
  const dropdownSimpleMenu = useMemo(() => <DshDropdown.Menu><DshDropdown.Item>菜单项 1</DshDropdown.Item><DshDropdown.Item>菜单项 2</DshDropdown.Item><DshDropdown.Item>菜单项 3</DshDropdown.Item></DshDropdown.Menu>, [])
  return (
    <>
      <h2 id="dropdown-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>Dropdown 默认通过悬停触发，也可以使用点击、聚焦或右键触发。菜单由 Menu、Title、Item 和 Divider 组合而成。</p>
      <DemoCard source={'<DshDropdown showTick position="bottomLeft" render={\n  <DshDropdown.Menu>\n    <DshDropdown.Title>工作区</DshDropdown.Title>\n    <DshDropdown.Item icon={<DshIconFolder />}>插件</DshDropdown.Item>\n    <DshDropdown.Item disabled>应用</DshDropdown.Item>\n    <DshDropdown.Divider />\n    <DshDropdown.Item type="danger">删除</DshDropdown.Item>\n  </DshDropdown.Menu>\n}>\n  <DshButton>打开菜单</DshButton>\n</DshDropdown>'}>
        <DshDropdown trigger="click" showTick position="bottomLeft" render={dropdownMenu}>
          <DshButton type="secondary" theme="light" icon={<DshIconChevronDown />}>打开菜单</DshButton>
        </DshDropdown>
      </DemoCard>

      <h2 id="dropdown-nested" className={sectionTitle}>嵌套使用</h2>
      <p className={sectionText}>嵌套 Dropdown 适合承载多级操作，子菜单可以从父菜单项的右侧展开。</p>
      <DemoCard source={'<DshDropdown render={\n  <DshDropdown.Menu>\n    <DshDropdown position="rightTop" render={subMenu}>\n      <DshDropdown.Item>导出</DshDropdown.Item>\n    </DshDropdown>\n  </DshDropdown.Menu>\n}>...</DshDropdown>'}>
        <DshDropdown render={<DshDropdown.Menu><DshDropdown position="rightTop" trigger="hover" render={nestedDropdownMenu}><DshDropdown.Item icon={<DshIconFolderOpen />}>导出</DshDropdown.Item></DshDropdown><DshDropdown.Item>重命名</DshDropdown.Item><DshDropdown.Item disabled>移动到（禁用）</DshDropdown.Item></DshDropdown.Menu>}>
          <DshButton type="secondary" theme="light">打开多级菜单</DshButton>
        </DshDropdown>
      </DemoCard>

      <h2 id="dropdown-position" className={sectionTitle}>弹出位置</h2>
      <p className={sectionText}>使用 `position` 调整菜单相对触发器的方向，常用位置包括 bottom、bottomLeft 和 bottomRight。</p>
      <DemoCard source={'<DshDropdown position="bottom" />\n<DshDropdown position="bottomLeft" />\n<DshDropdown position="bottomRight" />'}>
        <div className={demo}>
          <DshDropdown trigger="click" position="bottom" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottom</DshButton></DshDropdown>
          <DshDropdown trigger="click" position="bottomLeft" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottomLeft</DshButton></DshDropdown>
          <DshDropdown trigger="click" position="bottomRight" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottomRight</DshButton></DshDropdown>
        </div>
      </DemoCard>

      <h2 id="dropdown-trigger" className={sectionTitle}>触发方式</h2>
      <p className={sectionText}>官方 Dropdown 支持 hover、focus、click、custom 和 contextMenu 五种触发方式。</p>
      <DemoCard source={'<DshDropdown trigger="hover" />\n<DshDropdown trigger="focus" />\n<DshDropdown trigger="click" />\n<DshDropdown trigger="custom" visible={visible} />\n<DshDropdown trigger="contextMenu" />'}>
        <div className={demo}>
          <DshDropdown trigger="hover" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Hover</DshButton></DshDropdown>
          <DshDropdown trigger="focus" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Focus</DshButton></DshDropdown>
          <DshDropdown trigger="click" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Click</DshButton></DshDropdown>
          <DshDropdown trigger="custom" visible={dropdownCustomVisible} onVisibleChange={setDropdownCustomVisible} render={dropdownSimpleMenu}><DshButton type="secondary" theme="light" onClick={() => { setDropdownCustomVisible(value => !value) }}>Custom</DshButton></DshDropdown>
          <DshDropdown trigger="contextMenu" position="bottomRight" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">右键打开</DshButton></DshDropdown>
        </div>
      </DemoCard>

      <h2 id="dropdown-events" className={sectionTitle}>触发事件</h2>
      <p className={sectionText}>菜单项支持 onClick、onMouseEnter、onMouseLeave 和 onContextMenu 事件，当前事件会显示在示例下方。</p>
      <DemoCard source={'<DshDropdown.Item onClick={handleClick}>点击事件</DshDropdown.Item>\n<DshDropdown.Item onMouseEnter={handleEnter}>移入事件</DshDropdown.Item>\n<DshDropdown.Item onContextMenu={handleContextMenu}>右键事件</DshDropdown.Item>'}>
        <div className={stack}>
          <DshDropdown trigger="click" position="bottomLeft" render={dropdownEventMenu}><DshButton type="secondary" theme="light">打开事件菜单</DshButton></DshDropdown>
          <span className="dsh-semi-showcase-event-status" role="status">{dropdownEvent}</span>
        </div>
      </DemoCard>

      <h2 id="dropdown-json" className={sectionTitle}>JSON 用法</h2>
      <p className={sectionText}>简单菜单可以通过 `menu` 数组快速配置标题、菜单项、分隔线、图标、类型和激活态。</p>
      <DemoCard source={'const menu = [\n  { node: "title", name: "快捷操作" },\n  { node: "item", name: "新建文件", type: "primary", active: true },\n  { node: "divider" },\n  { node: "item", name: "清理缓存", type: "danger" },\n]\n<DshDropdown menu={menu} showTick />'}>
        <DshDropdown trigger="click" showTick position="bottomLeft" menu={dropdownJsonMenu}><DshButton type="secondary" theme="light">打开 JSON 菜单</DshButton></DshDropdown>
      </DemoCard>

      <h2 id="dropdown-api" className={sectionTitle}>API 参考</h2>
      <p className={sectionText}>以下是本页覆盖的核心属性和组合组件，完整 API 以 Semi 官方文档为准。</p>
      <div className={dropdownApiTable} role="table" aria-label="Dropdown API 参考">
        <strong className={`${dropdownApiCell} dsh-semi-showcase-dropdown-api-header`}>属性</strong><strong className={`${dropdownApiCell} dsh-semi-showcase-dropdown-api-header`}>用途</strong><strong className={`${dropdownApiCell} dsh-semi-showcase-dropdown-api-header`}>示例</strong>
        <span className={dropdownApiCell}>trigger</span><span className={dropdownApiCell}>控制菜单的触发方式</span><code className={dropdownApiCell}>hover / focus / click / contextMenu</code>
        <span className={dropdownApiCell}>render / menu</span><span className={dropdownApiCell}>提供 React 菜单或 JSON 菜单</span><code className={dropdownApiCell}>DshDropdown.Menu</code>
        <span className={dropdownApiCell}>position</span><span className={dropdownApiCell}>调整浮层相对触发器的位置</span><code className={dropdownApiCell}>bottomLeft</code>
        <span className={dropdownApiCell}>showTick</span><span className={dropdownApiCell}>为 active 菜单项显示选中标记</span><code className={dropdownApiCell}>true</code>
      </div>
    </>
  )
}

/** 浮层：点击 / 悬停触发与位置箭头。 */
export function PopoverSection(): ReactNode {
  const popoverContent = useMemo(() => <div className="dsh-semi-showcase-popover-content"><strong>Popover 内容</strong><span className="dsh-semi-showcase-secondary-text">这是由调用方传入的自定义内容。</span></div>, [])
  return (
    <>
      <h2 id="popover-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>Popover 用于展示补充信息或轻量交互内容，点击触发后不会影响当前页面上下文。</p>
      <DemoCard source={'<DshPopover trigger="click" content={content}>\n  <DshButton>打开 Popover</DshButton>\n</DshPopover>'}><DshPopover trigger="click" position="top" showArrow content={popoverContent}><DshButton type="secondary" theme="light">打开 Popover</DshButton></DshPopover></DemoCard>
      <h2 className={sectionTitle}>箭头与位置</h2>
      <p className={sectionText}>使用 `position` 和 `showArrow` 控制浮层定位与指向，内容由 Popover 的 `content` 属性提供。</p>
      <DemoCard source={'<DshPopover position="right" showArrow content="右侧内容">\n  <DshButton>右侧打开</DshButton>\n</DshPopover>'}><div className={demo}><DshPopover trigger="click" position="right" showArrow content={<span>右侧 Popover 内容</span>}><DshButton type="secondary" theme="light">右侧打开</DshButton></DshPopover><DshPopover trigger="hover" position="bottomLeft" content={<span>悬停显示内容</span>}><DshButton type="secondary" theme="light">悬停打开</DshButton></DshPopover></div></DemoCard>
    </>
  )
}
