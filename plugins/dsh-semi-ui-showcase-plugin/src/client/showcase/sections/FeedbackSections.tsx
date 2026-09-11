// 反馈类组件 demo：Modal、Progress、Spin、Toast、Skeleton。
import type { ReactNode } from 'react'
import {
  DshButton,
  DshIconAlertCircle,
  DshIconCheckCircle,
  DshIconHelpCircle,
  DshIconInfoCircle,
  DshModal,
  DshProgress,
  DshSkeleton,
  DshSpin,
  DshToast,
} from '@tnnevol/dsh-semi-ui'
import { useEffect, useState } from 'react'
import { demo, demoLabel, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import type { ModalDemo } from '../types.ts'

const modalMethods = [
  ['info', '信息', DshIconInfoCircle],
  ['success', '成功', DshIconCheckCircle],
  ['error', '错误', DshIconAlertCircle],
  ['warning', '警告', DshIconAlertCircle],
  ['confirm', '确认', DshIconHelpCircle],
] as const
type ModalMethod = typeof modalMethods[number][0]
const modalApi = DshModal as unknown as Record<ModalMethod, (props: Record<string, unknown>) => unknown>
type ToastCallOptions = { content: ReactNode; duration?: number; stack?: boolean }
const toastApi = DshToast as unknown as Record<'info' | 'success' | 'warning' | 'error', (options: ToastCallOptions) => string>

export function ProgressSection(): ReactNode {
  return (
    <>
      <h2 id="progress-basic" className={sectionTitle}>标准进度条</h2>
      <p className={sectionText}>通过 `percent` 控制完成度，通过 `stroke`、`size` 和 `showInfo` 调整展示状态。</p>
      <DemoCard source={'<DshProgress percent={10} />\n<DshProgress percent={50} />\n<DshProgress percent={80} size="large" />'}><div className="dsh-semi-showcase-stack dsh-semi-showcase-progress-stack"><DshProgress percent={10} aria-label="10%" /><DshProgress percent={50} aria-label="50%" /><DshProgress percent={80} size="large" aria-label="80%" /><DshProgress percent={65} stroke="var(--dsw-alias-state-warn-primary)" aria-label="65% warning" /></div></DemoCard>
      <h2 id="progress-circle" className={sectionTitle}>圆形进度条</h2>
      <DemoCard source={'<DshProgress type="circle" percent={50} />'}><div className={demo}><DshProgress type="circle" percent={25} aria-label="25%" /><DshProgress type="circle" percent={50} aria-label="50%" /><DshProgress type="circle" percent={75} size="large" aria-label="75%" /></div></DemoCard>
      <h2 id="progress-format" className={sectionTitle}>自定义文本</h2>
      <DemoCard source={'<DshProgress percent={80} format={percent => `${percent} / 100`} />'}><DshProgress percent={80} showInfo format={(percent: number) => `${percent} / 100`} aria-label="80 / 100" /></DemoCard>
    </>
  )
}

export function SpinSection(): ReactNode {
  return (
    <>
      <h2 id="spin-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>Spin 用于展示不确定时长的加载过程，支持延迟、提示文本和自定义指示器。</p>
      <DemoCard source={'<DshSpin />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-spin-demo"><DshSpin size="small" /><DshSpin size="middle" /><DshSpin size="large" /></div></DemoCard>
      <h2 id="spin-size" className={sectionTitle}>尺寸</h2>
      <DemoCard source={'<DshSpin size="small" />\n<DshSpin size="middle" />\n<DshSpin size="large" />'}><div className={stack}><div className={demo}><DshSpin size="small" /><span className={demoLabel}>small</span><DshSpin size="middle" /><span className={demoLabel}>middle</span><DshSpin size="large" /><span className={demoLabel}>large</span></div></div></DemoCard>
      <h2 id="spin-content" className={sectionTitle}>包裹内容</h2>
      <DemoCard source={'<DshSpin tip="加载中...">\n  <div>需要等待的内容</div>\n</DshSpin>'}><DshSpin tip="加载中..."><div className="dsh-semi-showcase-spin-content">需要等待的内容</div></DshSpin></DemoCard>
    </>
  )
}

export function ToastSection(): ReactNode {
  const [toastId, setToastId] = useState<string>()
  return (
    <>
      <h2 id="toast-basic" className={sectionTitle}>普通提示</h2>
      <p className={sectionText}>Toast 使用命令式 API 及时反馈操作结果，浮层样式由共享 DSH 主题统一管理。</p>
      <DemoCard source={'DshToast.info({ content: "这是一条提示" })'}><div className={demo}><DshButton type="secondary" theme="light" onClick={() => { toastApi.info({ content: '这是一条普通提示', duration: 3 }) }}>普通提示</DshButton></div></DemoCard>
      <h2 id="toast-status" className={sectionTitle}>状态提示</h2>
      <DemoCard source={'DshToast.success({ content: "操作成功" })\nDshToast.warning({ content: "请注意" })\nDshToast.error({ content: "操作失败" })'}><div className={demo}><DshButton type="primary" theme="light" onClick={() => { toastApi.info({ content: '信息提示', duration: 3 }) }}>信息</DshButton><DshButton type="secondary" theme="light" onClick={() => { toastApi.success({ content: '操作成功', duration: 3 }) }}>成功</DshButton><DshButton type="warning" theme="light" onClick={() => { toastApi.warning({ content: '请注意当前状态', duration: 3 }) }}>警告</DshButton><DshButton type="danger" theme="light" onClick={() => { toastApi.error({ content: '操作失败', duration: 3 }) }}>错误</DshButton></div></DemoCard>
      <h2 id="toast-control" className={sectionTitle}>手动关闭与堆叠</h2>
      <DemoCard source={'const id = DshToast.info({ content: "不会自动关闭", duration: 0 })\nDshToast.close(id)'}><div className={demo}><DshButton type="secondary" theme="light" onClick={() => { setToastId(toastApi.info({ content: '这条提示需要手动关闭', duration: 0 })) }}>手动打开</DshButton><DshButton type="secondary" theme="light" disabled={toastId === undefined} onClick={() => { if (toastId !== undefined) { DshToast.close(toastId); setToastId(undefined) } }}>关闭 Toast</DshButton><DshButton type="secondary" theme="light" onClick={() => { toastApi.info({ content: '堆叠提示 1', duration: 5, stack: true }); toastApi.success({ content: '堆叠提示 2', duration: 5, stack: true }); toastApi.warning({ content: '堆叠提示 3', duration: 5, stack: true }) }}>显示堆叠</DshButton></div></DemoCard>
    </>
  )
}

export function ModalSection(): ReactNode {
  const [modalVisible, setModalVisible] = useState(false)
  const [modalDemo, setModalDemo] = useState<ModalDemo>('basic')
  const openModal = (demo: ModalDemo): void => {
    setModalDemo(demo)
    setModalVisible(true)
  }
  const closeModal = (): void => { setModalVisible(false) }
  const modalBody = modalDemo === 'styled'
    ? <div className="dsh-semi-showcase-modal-scroll"><p>Modal 的内容区域可以独立滚动，不会改变页面上下文。</p><p>这是与官方示例一致的 bodyStyle 场景，用于验证长内容、背景、文字和滚动条的主题状态。</p><p>DSH 的主题变量会同时作用于 Modal 表面、边框、遮罩和按钮。</p></div>
    : modalDemo === 'customFooter'
      ? <div><p>自定义页脚只保留明确的操作，适合需要额外说明的对话框。</p><p className="dsh-semi-showcase-secondary-text">页脚由调用方渲染。</p></div>
      : <div><p>{modalDemo === 'mask' ? '点击遮罩层不会关闭当前对话框。' : '这是一个受控 Modal，用于验证标题、内容、关闭按钮和确认/取消操作。'}</p><p className="dsh-semi-showcase-secondary-text">点击确认或取消返回预览页面。</p></div>
  const modalFooter = <div className="dsh-semi-showcase-modal-footer"><DshButton type="secondary" theme="light" onClick={closeModal}>了解更多</DshButton><DshButton type="primary" theme="solid" onClick={closeModal}>继续</DshButton></div>
  // 卸载时清理命令式 Modal / Toast 浮层。
  useEffect(() => () => { DshModal.destroyAll?.(); DshToast.destroyAll?.() }, [])
  return (
    <>
      <h2 id="modal-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>对话框用于等待用户响应、告知重要信息或在不丢失上下文的情况下展示更多信息。</p>
      <DemoCard source={'<DshModal title="基本对话框" visible={visible}\n  onOk={close} onCancel={close} closeOnEsc />'}><div className={demo}><DshButton type="primary" theme="solid" onClick={() => { openModal('basic') }}>打开基本对话框</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('footerFill') }}>底部撑满</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('mask') }}>遮罩不可关闭</DshButton></div></DemoCard>
      <h2 id="modal-states" className={sectionTitle}>按钮与内容状态</h2>
      <p className={sectionText}>通过 footerFill、okButtonProps、cancelButtonProps、header、footer、centered 和滚动内容展示官方文档中的常用状态。</p>
      <DemoCard source={'<DshModal footerFill />\n<DshModal okButtonProps={{ size: "small", type: "warning" }} />\n<DshModal header={null} footer={footer} />'}><div className={demo}><DshButton type="secondary" theme="light" onClick={() => { openModal('buttonProps') }}>自定义按钮属性</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('customFooter') }}>自定义页脚</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('styled') }}>居中与滚动内容</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('fullscreen') }}>全屏 Modal</DshButton></div></DemoCard>
      <h2 id="modal-methods" className={sectionTitle}>信息反馈状态</h2>
      <p className={sectionText}>命令式 Modal 提供信息、成功、错误、警告和确认五种状态，图标与按钮颜色均使用 DSH 主题变量。</p>
      <DemoCard source={'DshModal.info({ title: "信息", content: "..." })\nDshModal.success({ title: "成功", content: "..." })\nDshModal.error({ title: "错误", content: "..." })\nDshModal.warning({ title: "警告", content: "..." })\nDshModal.confirm({ title: "确认", content: "..." })'}>
        <div className={demo}>
          {modalMethods.map(([method, label, MethodIcon]) => (
            <DshButton key={method} type={method === 'error' ? 'danger' : method === 'warning' ? 'warning' : 'primary'} theme="light" icon={<MethodIcon />} onClick={() => { modalApi[method]({ title: `${label}状态`, content: `这是 ${label} Modal 的内容，用于验证图标、正文、按钮和遮罩状态。`, okText: '确定', cancelText: '取消' }) }}>{label}</DshButton>
          ))}
        </div>
      </DemoCard>
      <DshModal {...(modalDemo === 'customFooter' ? { footer: modalFooter } : {})} title={modalDemo === 'customFooter' ? '自定义页脚' : modalDemo === 'fullscreen' ? '全屏对话框' : modalDemo === 'mask' ? '遮罩不可关闭' : modalDemo === 'buttonProps' ? '自定义按钮属性' : modalDemo === 'styled' ? '自定义样式' : modalDemo === 'footerFill' ? '底部撑满' : '基本对话框'} visible={modalVisible} centered={modalDemo === 'styled' || modalDemo === 'fullscreen'} fullScreen={modalDemo === 'fullscreen'} footerFill={modalDemo === 'footerFill'} maskClosable={modalDemo !== 'mask'} closeOnEsc okText="确定" cancelText="取消" okButtonProps={modalDemo === 'buttonProps' ? { size: 'small', type: 'warning' } : undefined} cancelButtonProps={modalDemo === 'buttonProps' ? { size: 'small', disabled: true } : undefined} header={modalDemo === 'customFooter' ? null : undefined} onCancel={closeModal} onOk={closeModal}>{modalBody}</DshModal>
    </>
  )
}

export function SkeletonSection(): ReactNode {
  const [skeletonLoading, setSkeletonLoading] = useState(true)
  return (
    <>
      <h2 id="skeleton-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>骨架屏由 Avatar、Title、Paragraph、Button、Image 占位元素组合而成，`loading` 为 true 时展示占位内容。</p>
      <DemoCard source={'<DshSkeleton placeholder={<DshSkeleton.Avatar />} loading={true}>\n  <DshAvatar color="blue">SE</DshAvatar>\n</DshSkeleton>'}>
        <div className={demo}>
          <DshSkeleton placeholder={<DshSkeleton.Avatar />} loading active />
          <DshSkeleton style={{ width: 200 }} placeholder={<DshSkeleton.Image />} loading active />
        </div>
      </DemoCard>
      <h2 id="skeleton-combo" className={sectionTitle}>组合占位</h2>
      <p className={sectionText}>组合使用占位元素可以模拟一段完整的加载中内容。</p>
      <DemoCard source={'<DshSkeleton\n  loading={true} active\n  placeholder={\n    <div style={{ display: "flex" }}>\n      <DshSkeleton.Avatar style={{ marginRight: 12 }} />\n      <div>\n        <DshSkeleton.Title style={{ width: 120 }} />\n        <DshSkeleton.Paragraph rows={2} />\n      </div>\n    </div>\n  }\n>\n  <div>加载完成的内容</div>\n</DshSkeleton>'}>
        <div className={demo}>
          <DshSkeleton
            loading
            active
            placeholder={(
              <div style={{ display: 'flex' }}>
                <DshSkeleton.Avatar style={{ marginRight: 12 }} />
                <div>
                  <DshSkeleton.Title style={{ width: 120 }} />
                  <DshSkeleton.Paragraph rows={2} style={{ width: 240 }} />
                </div>
              </div>
            )}
          >
            <div>加载完成的内容</div>
          </DshSkeleton>
        </div>
      </DemoCard>
      <h2 id="skeleton-toggle" className={sectionTitle}>加载切换</h2>
      <p className={sectionText}>切换 `loading` 属性可以在骨架占位与真实内容之间过渡，按钮和整块占位同理。</p>
      <DemoCard source={'const [loading, setLoading] = useState(true)\n<DshSkeleton placeholder={<DshSkeleton.Button />} loading={loading}>\n  <DshButton>真实按钮</DshButton>\n</DshSkeleton>\n<Button onClick={() => setLoading(!loading)}>{loading ? "显示内容" : "显示骨架"}</Button>'}>
        <div className={stack}>
          <div className={demo}>
            <DshSkeleton placeholder={<DshSkeleton.Button />} loading={skeletonLoading}><DshButton type="primary" theme="solid">真实按钮</DshButton></DshSkeleton>
            <DshButton type="secondary" theme="light" onClick={() => { setSkeletonLoading(value => !value) }}>{skeletonLoading ? '显示内容' : '显示骨架'}</DshButton>
          </div>
          <DshSkeleton loading={skeletonLoading} active placeholder={<DshSkeleton.Paragraph rows={3} style={{ width: 320 }} />}>
            <span className="dsh-semi-showcase-secondary-text">段落占位对应的真实内容：从明天起，做一个幸福的人。</span>
          </DshSkeleton>
        </div>
      </DemoCard>
    </>
  )
}
