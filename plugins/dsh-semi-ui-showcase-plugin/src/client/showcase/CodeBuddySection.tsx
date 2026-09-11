import type { ReactNode } from 'react'
import {
  DshButton,
  DshCollapse,
  DshForm,
  DshIconAlertCircle,
  DshIconRefresh,
  DshInput,
  DshModal,
  DshSpin,
  DshSwitch,
  DshTag,
  DshToast,
  DshTypography,
} from '@tnnevol/dsh-semi-ui'
import { useState } from 'react'
import { demo, sectionTitle, sectionText } from './class-names.ts'
import { CodeBuddyDemoLogo } from './CodeBuddyLogo.tsx'
import { CodeBuddyUsageSection } from './CodeBuddyUsageSection.tsx'
import { CodeBuddyPrefsSection } from './CodeBuddyPrefsSection.tsx'
import { DemoCard } from './DemoCard.tsx'

/** 与 CodeBuddySection 账号管理区同结构的演示账号。 */
type DemoAccount = { id: string, name: string, uid: string, tag: string, uid2?: string, enterprise?: string }

export function CodeBuddySection(): ReactNode {
  const [userAccounts, setUserAccounts] = useState<DemoAccount[]>([
    { id: 'u-01', name: '主账号', uid: '9584b7fb-14ef-4ada-af99-b5eb10ecaf2e', tag: '当前', uid2: '10086' },
    { id: 'u-02', name: '体验账号', uid: '3f2a9c81-7c55-4e21-9a30-8d1b2c4d5e6f', tag: '备用', enterprise: '示例科技（深圳）有限公司' },
    { id: 'u-03', name: '涨涨涨', uid: 'c81e728d-9d54-4b21-b9a6-0b1d3a5f7e89', tag: '备用', uid2: '10010' },
  ])
  // Which state variant the 多状态展示 grid renders: loading / empty /
  // signed-out / error are static fixtures; normal edits the shared roster.
  const [cbDemoState, setCbDemoState] = useState<'roster' | 'loading' | 'empty' | 'signed-out' | 'error'>('roster')
  // 添加账号表单 state.
  const [cbFormOpen, setCbFormOpen] = useState(false)
  const [cbFormNickname, setCbFormNickname] = useState('')
  const [cbFormEnterprise, setCbFormEnterprise] = useState(false)
  // 危险操作确认 demo state: the pending-removal account id.
  const [cbRemoveTarget, setCbRemoveTarget] = useState<string | undefined>(undefined)
  // 账号掉线 demo state: ids of accounts whose refresh credential expired.
  const [cbExpiredIds, setCbExpiredIds] = useState<string[]>([])
  // Re-login flow state: which expired account is being re-authenticated.
  const [cbReloginTarget, setCbReloginTarget] = useState<string | undefined>(undefined)
  // 添加账号弹框的提交动作：抽出为命名回调，避免 JSX 属性里多层嵌套括号。
  // 复制登录链接由 Typography.Text 的 copyable 内置能力承担（图标跟随标题、
  // 自动反馈复制成功），不再需要自建剪贴板回调。
  const cbSubmitAccount = (): void => {
    setCbFormOpen(false)
    setCbDemoState('roster')
    setUserAccounts(items => [...items, {
      id: `u-${String(items.length + 1).padStart(2, '0')}`,
      name: cbFormNickname.trim().length > 0 ? cbFormNickname.trim() : `新账号 ${items.length + 1}`,
      uid: `新增-${items.length + 1}`,
      tag: '当前',
      ...(cbFormEnterprise ? { enterprise: '示例科技（深圳）有限公司' } : {}),
    }].map((item, index, all) => index === all.length - 1 ? item : { ...item, tag: '备用' }))
    DshToast.success({ content: '演示：登录成功后该账号会成为当前账号' })
  }
  // 偏好设置 demo state.
  return (
            <>
              {/* 完整形态：与 CodeBuddySection 账号管理区同名 class 的 1:1 预览。 */}
              <h2 id="cb-full" className={sectionTitle}>完整形态</h2>
              <p className={sectionText}>与 CodeBuddy 插件「账号管理」设置区同名 class、同一套结构的 1:1 预览：每个账号一个折叠面板，头部为昵称 + 绿色「当前」Tag；激活账号头部无操作按钮，其余账号放「设为当前」；展开后是账号信息行与「删除账号」。</p>
              <DemoCard source={'// 与 CodeBuddySection 的账号管理区结构一致（同名 class）\n<div className="dsh-codebuddy-accounts">\n  <div className="dsh-codebuddy-accounts-head">\n    <span className="dsh-codebuddy-accounts-title">账号管理</span>\n    <Button size="small" theme="solid" type="primary" onClick={openAddForm}>添加账号</Button>\n  </div>\n  <p className="dsh-codebuddy-accounts-desc">已登录的 CodeBuddy 账号……</p>\n  <Collapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left">\n    {accounts.map(account => (\n      <Collapse.Panel\n        key={account.id}\n        itemKey={account.id}\n        header={\n          <span className="dsh-codebuddy-account-header">\n            <span className="dsh-codebuddy-account-name">{account.nickname}</span>\n            {account.active && <Tag size="small" type="solid" color="green">当前</Tag>}\n          </span>\n        }\n        extra={account.active ? undefined : (\n          <Button size="small" theme="light" type="secondary">设为当前</Button>\n        )}\n      >\n        <div className="dsh-codebuddy-account-body">…账号信息行…</div>\n      </Collapse.Panel>\n    ))}\n  </Collapse>\n</div>'}>
                <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                  <div className="dsh-codebuddy-title-row">
                    <CodeBuddyDemoLogo />
                    <h2 className="dsh-codebuddy-title">CodeBuddy</h2>
                  </div>
                  <p className="dsh-codebuddy-desc">使用腾讯 CodeBuddy 账号登录。</p>
                  <div className="dsh-codebuddy-accounts">
                    <div className="dsh-codebuddy-accounts-head">
                      <span className="dsh-codebuddy-accounts-title">账号管理</span>
                      <DshButton
                        htmlType="button"
                        size="small"
                        theme="solid"
                        type="primary"
                        onClick={() => { setCbFormOpen(true); setCbFormNickname(''); setCbFormEnterprise(false) }}
                      >
                        添加账号
                      </DshButton>
                    </div>
                    <p className="dsh-codebuddy-accounts-desc">已登录的 CodeBuddy 账号。展开面板可管理对应账号；请求均使用当前账号。</p>
                    <DshCollapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left" defaultActiveKey="u-01">
                      {userAccounts.map(user => (
                        <DshCollapse.Panel
                          key={user.id}
                          itemKey={user.id}
                          header={(
                            <span className="dsh-codebuddy-account-header">
                              <span className="dsh-codebuddy-account-name">{user.name}</span>
                              {user.tag === '当前' ? <DshTag size="small" type="solid" color="green">当前</DshTag> : null}
                            </span>
                          )}
                          extra={user.tag === '当前' ? undefined : (
                            <DshButton
                              htmlType="button"
                              size="small"
                              theme="light"
                              type="secondary"
                              onClick={() => { setUserAccounts(items => items.map(item => ({ ...item, tag: item.id === user.id ? '当前' : '备用' }))) }}
                            >
                              设为当前
                            </DshButton>
                          )}
                        >
                          <div className="dsh-codebuddy-account-body">
                            <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UID</span><span className="dsh-codebuddy-row-value">{user.uid}</span></div>
                            {user.enterprise !== undefined
                              ? <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">企业</span><span className="dsh-codebuddy-row-value">{user.enterprise}</span></div>
                              : null}
                            <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UIN</span><span className="dsh-codebuddy-row-value">{user.uid2 ?? '—'}</span></div>
                            <div className="dsh-codebuddy-account-remove">
                              <DshButton
                                htmlType="button"
                                size="small"
                                type="danger"
                                theme="borderless"
                                onClick={() => { setCbRemoveTarget(user.id) }}
                              >
                                删除账号
                              </DshButton>
                            </div>
                          </div>
                        </DshCollapse.Panel>
                      ))}
                    </DshCollapse>
                  </div>
                </div>
              </DemoCard>

              {/* 多状态展示：加载 / 空 / 未登录过期 / 错误 / 已登录花名册。 */}
              <h2 id="cb-states" className={sectionTitle}>多状态展示</h2>
              <p className={sectionText}>账号区在真实插件中的五种运行状态：加载中（首发拉取）、空（从未登录）、未登录（凭据过期，需重新登录）、错误（RPC 或凭据文件不可读）、正常花名册。切换下方按钮对比各状态的排版。</p>
              <DemoCard source={'type AccountsState = "loading" | "empty" | "signed-out" | "error" | "roster"\n\n// loading     → <Spin size="middle" /> 包裹占位\n// empty       → 「暂无已登录账号。」+ 主 CTA「添加账号」\n// signed-out  → 黄色提示「登录已过期」+ 「重新登录」主按钮\n// error       → 红色错误行 + 重试按钮\n// roster      → 正常折叠面板列表'}>
                <div className={demo}>
                  {([['roster', '正常'], ['loading', '加载中'], ['empty', '空'], ['signed-out', '未登录'], ['error', '错误']] as const).map(([state, label]) => (
                    <DshButton key={state} type={cbDemoState === state ? 'primary' : 'secondary'} theme={cbDemoState === state ? 'solid' : 'light'} size="small" onClick={() => { setCbDemoState(state) }}>{label}</DshButton>
                  ))}
                </div>
                <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                  <div className="dsh-codebuddy-accounts">
                    <div className="dsh-codebuddy-accounts-head">
                      <span className="dsh-codebuddy-accounts-title">账号管理</span>
                      {cbDemoState !== 'loading' ? <DshButton htmlType="button" size="small" theme="solid" type="primary" onClick={() => { setCbDemoState('roster') }}>添加账号</DshButton> : null}
                    </div>
                    {cbDemoState === 'loading' ? (
                      <div className="dsh-semi-showcase-collapse-state-block"><DshSpin size="middle" /><span className="dsh-codebuddy-accounts-desc">正在加载账号…</span></div>
                    ) : cbDemoState === 'empty' ? (
                      <div className="dsh-semi-showcase-collapse-state-block">
                        <span className="dsh-codebuddy-accounts-desc">暂无已登录账号。点击「添加账号」完成浏览器登录。</span>
                      </div>
                    ) : cbDemoState === 'signed-out' ? (
                      <div className="dsh-semi-showcase-collapse-state-block dsh-semi-showcase-collapse-state-warn">
                        <span className="dsh-codebuddy-accounts-desc">登录已过期。之前的账号凭据已失效，需要重新登录才能继续使用。</span>
                        <DshButton htmlType="button" size="small" theme="solid" type="primary" onClick={() => { setCbDemoState('roster') }}>重新登录</DshButton>
                      </div>
                    ) : cbDemoState === 'error' ? (
                      <div className="dsh-semi-showcase-collapse-state-block">
                        <span className="dsh-codebuddy-error">not-found: 账号列表加载失败。</span>
                        <DshButton htmlType="button" size="small" theme="light" type="secondary" icon={<DshIconRefresh />} onClick={() => { setCbDemoState('roster') }}>重试</DshButton>
                      </div>
                    ) : (
                      <DshCollapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left">
                        {userAccounts.slice(0, 2).map(user => (
                          <DshCollapse.Panel
                            key={user.id}
                            itemKey={user.id}
                            header={(
                              <span className="dsh-codebuddy-account-header">
                                <span className="dsh-codebuddy-account-name">{user.name}</span>
                                {user.tag === '当前' ? <DshTag size="small" type="solid" color="green">当前</DshTag> : null}
                              </span>
                            )}
                          >
                            <div className="dsh-codebuddy-account-body">
                              <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UID</span><span className="dsh-codebuddy-row-value">{user.uid}</span></div>
                            </div>
                          </DshCollapse.Panel>
                        ))}
                      </DshCollapse>
                    )}
                  </div>
                </div>
              </DemoCard>

              {/* 添加账号表单。 */}
              <h2 id="cb-form" className={sectionTitle}>添加账号表单</h2>
              <p className={sectionText}>点上方「添加账号」或下方按钮弹出表单：昵称可选备注、企业账号开关，提交后追加一个演示账号。弹框标题右侧是 Semi Typography 自带的复制图标（Typography.Text 的 `copyable` 能力）：点击复制登录链接，成功后图标变对勾并显示"复制成功"，无需自建复制按钮。</p>
              <DemoCard source={'// 复制功能使用 Semi Typography 自带的 copyable：图标跟随标题，\n// 点击即复制并自动反馈（图标变对勾 + "复制成功"），无需手写剪贴板逻辑。\n<DshModal\n  title={\n    <DshTypography.Text copyable={{ content: loginLink }}>\n      添加 CodeBuddy 账号\n    </DshTypography.Text>\n  }\n  visible={visible} onOk={submit} onCancel={close}\n>\n  <DshForm labelPosition="top">\n    <DshForm.Slot label="备注名"><DshInput maxLength={120} placeholder="可选" /></DshForm.Slot>\n    <DshForm.Slot label="企业账号"><DshSwitch /></DshForm.Slot>\n  </DshForm>\n</DshModal>'}>
                <DshButton type="primary" theme="solid" onClick={() => { setCbFormOpen(true); setCbFormNickname(''); setCbFormEnterprise(false) }}>打开添加账号表单</DshButton>
                <DshModal
                  title={(
                    <DshTypography.Text copyable={{ content: 'https://auth.example.com/oauth/authorize?state=demo' }}>
                      添加 CodeBuddy 账号
                    </DshTypography.Text>
                  )}
                  visible={cbFormOpen}
                  closeOnEsc
                  onCancel={() => { setCbFormOpen(false) }}
                  onOk={() => { cbSubmitAccount() }}
                >
                  <div className="dsh-semi-showcase-collapse-create-body">
                    <DshForm className="dsh-semi-showcase-form" labelPosition="top">
                      <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>备注名</strong></span>}>
                        <DshInput className="dsh-semi-showcase-control" value={cbFormNickname} onChange={setCbFormNickname} placeholder="可选" showClear maxLength={120} />
                      </DshForm.Slot>
                      <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>企业账号</strong><span>企业账号登录后额外展示企业名称与部门信息。</span></span>}>
                        <DshSwitch checked={cbFormEnterprise} onChange={(checked: boolean) => { setCbFormEnterprise(checked) }} aria-label="企业账号" />
                      </DshForm.Slot>
                    </DshForm>
                    <p className="dsh-semi-showcase-secondary-text">点击标题右侧的复制图标可复制登录链接；演示中「打开登录页」直接创建账号，实际插件会在此步打开浏览器 OAuth 登录。</p>
                  </div>
                </DshModal>
              </DemoCard>

              {/* 危险操作确认。 */}
              <h2 id="cb-danger" className={sectionTitle}>危险操作确认</h2>
              <p className={sectionText}>删除账号前弹出确认 Modal：正文标明该账号将丢失的凭据与当前身份，删除当前账号时会提示后续将切换到的账号。在「完整形态」卡中点「删除账号」也会触发同一个确认。</p>
              <DemoCard source={'<DshModal\n  title="删除账号"\n  type="warning"\n  visible={visible}\n  okText="确认删除"\n  okButtonProps={{ type: "danger" }}\n  onOk={confirmRemove}\n  onCancel={close}\n>\n  确定删除该账号？其存储的登录凭据将被清除。\n</DshModal>'}>
                <DshButton type="danger" theme="light" onClick={() => { setCbRemoveTarget(userAccounts[0]?.id) }}>演示删除确认</DshButton>
              </DemoCard>

              {/* 账号掉线与重新登录。 */}
              <h2 id="cb-expired" className={sectionTitle}>账号掉线与重新登录</h2>
              <p className={sectionText}>多账号下其中某个账号凭据过期的场景：掉线账号的头部标记黄色「已掉线」Tag 并把「设为当前」换成「重新登录」主按钮；展开后显示掉线原因与恢复动作。若掉线的是当前账号，账单区顶部出现警示条，请求自动改由剩余账号中最靠前的可用账号接管（头部「当前」Tag 随之移动）。下方按钮把任一账号置为掉线/恢复，模拟一次完整生命周期。</p>
              <DemoCard source={'// 掉线账号的折叠面板：头部 Tag 与 extra 按账号状态切换\n{accounts.map(account => (\n  <Collapse.Panel\n    key={account.id}\n    itemKey={account.id}\n    header={\n      <span className="dsh-codebuddy-account-header">\n        <span className="dsh-codebuddy-account-name">{account.nickname}</span>\n        {account.expired\n          ? <Tag size="small" type="light" color="orange">已掉线</Tag>\n          : account.active && <Tag size="small" type="solid" color="green">当前</Tag>}\n      </span>\n    }\n    extra={account.expired\n      ? <Button size="small" theme="solid" type="primary">重新登录</Button>\n      : account.active ? undefined : <Button size="small" theme="light">设为当前</Button>}\n    >\n      {account.expired\n        ? <div className="dsh-codebuddy-account-expired">\n            <span>该账号的登录凭据已过期，无法发起请求或查询额度。</span>\n            <Button size="small" type="primary" theme="solid">重新登录</Button>\n          </div>\n        : <div className="dsh-codebuddy-account-body">…账号信息行…</div>}\n    </Collapse.Panel>\n  ))}\n}\n\n// 掉线的是当前账号时，面板顶部出现接管警示条\n{ takeoverBy && (\n  <div className="dsh-codebuddy-account-takeover">\n    当前账号已掉线，请求改由「{takeoverBy.nickname}」接管。为掉线账号重新登录后可切回。\n  </div>\n)'}>
                <div className={demo}>
                  <DshButton
                    htmlType="button"
                    size="small"
                    theme="light"
                    type={cbExpiredIds.length > 0 ? 'secondary' : 'warning'}
                    onClick={() => { setCbExpiredIds(ids => ids.length > 0 ? [] : [userAccounts.find(item => item.tag === '当前')?.id ?? 'u-01']) }}
                  >
                    {cbExpiredIds.length > 0 ? '全部恢复在线' : '让当前账号掉线'}
                  </DshButton>
                  <DshButton
                    htmlType="button"
                    size="small"
                    theme="light"
                    type="warning"
                    onClick={() => { setCbExpiredIds(ids => ids.length > 0 ? ids : ['u-03']) }}
                  >
                    让备用账号掉线
                  </DshButton>
                </div>
                <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                  <div className="dsh-codebuddy-accounts">
                    <div className="dsh-codebuddy-accounts-head">
                      <span className="dsh-codebuddy-accounts-title">账号管理</span>
                      <DshButton
                        htmlType="button"
                        size="small"
                        theme="solid"
                        type="primary"
                        onClick={() => { setCbFormOpen(true); setCbFormNickname(''); setCbFormEnterprise(false) }}
                      >
                        添加账号
                      </DshButton>
                    </div>
                    <p className="dsh-codebuddy-accounts-desc">已登录的 CodeBuddy 账号。展开面板可管理对应账号；请求均使用当前账号。</p>
                    {(() => {
                      const expiredActive = userAccounts.find(item => item.id === cbExpiredIds[0] && item.tag === '当前')
                      const takeoverBy = expiredActive !== undefined
                        ? userAccounts.find(item => !cbExpiredIds.includes(item.id) && item.id !== expiredActive.id)
                        : undefined
                      return (
                        <>
                          {expiredActive !== undefined && takeoverBy !== undefined ? (
                            <div className="dsh-codebuddy-account-takeover">
                              <DshIconAlertCircle aria-hidden />
                              <span>当前账号「{expiredActive.name}」已掉线，请求改由「{takeoverBy.name}」接管。为掉线账号重新登录后可切回。</span>
                            </div>
                          ) : null}
                          <DshCollapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left" defaultActiveKey={cbExpiredIds[0] ?? undefined}>
                            {userAccounts.map(user => {
                              const expired = cbExpiredIds.includes(user.id)
                              return (
                                <DshCollapse.Panel
                                  key={user.id}
                                  itemKey={user.id}
                                  header={(
                                    <span className="dsh-codebuddy-account-header">
                                      <span className="dsh-codebuddy-account-name">{user.name}</span>
                                      {expired
                                        ? <DshTag size="small" type="light" color="orange">已掉线</DshTag>
                                        : user.tag === '当前' ? <DshTag size="small" type="solid" color="green">当前</DshTag> : null}
                                    </span>
                                  )}
                                  extra={expired ? (
                                    <DshButton
                                      htmlType="button"
                                      size="small"
                                      theme="solid"
                                      type="primary"
                                      onClick={() => { setCbReloginTarget(user.id) }}
                                    >
                                      重新登录
                                    </DshButton>
                                  ) : user.tag === '当前' ? undefined : (
                                    <DshButton
                                      htmlType="button"
                                      size="small"
                                      theme="light"
                                      type="secondary"
                                      onClick={() => { setUserAccounts(items => items.map(item => ({ ...item, tag: item.id === user.id ? '当前' : '备用' }))) }}
                                    >
                                      设为当前
                                    </DshButton>
                                  )}
                                >
                                  {expired ? (
                                    <div className="dsh-codebuddy-account-expired">
                                      <span className="dsh-codebuddy-account-expired-text">该账号的登录凭据已过期，无法发起请求或查询额度。重新登录后凭据与额度信息会自动恢复，历史偏好保留。</span>
                                      <DshButton
                                        htmlType="button"
                                        size="small"
                                        theme="solid"
                                        type="primary"
                                        onClick={() => { setCbReloginTarget(user.id) }}
                                      >
                                        重新登录
                                      </DshButton>
                                    </div>
                                  ) : (
                                    <div className="dsh-codebuddy-account-body">
                                      <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UID</span><span className="dsh-codebuddy-row-value">{user.uid}</span></div>
                                      {user.enterprise !== undefined
                                        ? <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">企业</span><span className="dsh-codebuddy-row-value">{user.enterprise}</span></div>
                                        : null}
                                      <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UIN</span><span className="dsh-codebuddy-row-value">{user.uid2 ?? '—'}</span></div>
                                      <div className="dsh-codebuddy-account-remove">
                                        <DshButton
                                          htmlType="button"
                                          size="small"
                                          type="danger"
                                          theme="borderless"
                                          onClick={() => { setCbRemoveTarget(user.id) }}
                                        >
                                          删除账号
                                        </DshButton>
                                      </div>
                                    </div>
                                  )}
                                </DshCollapse.Panel>
                              )
                            })}
                          </DshCollapse>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </DemoCard>

              <CodeBuddyUsageSection />
  <CodeBuddyPrefsSection />
            {/* 删除确认 Modal：完整形态与危险操作演示共用。 */}
            <DshModal
              title="删除账号"
              type="warning"
              visible={cbRemoveTarget !== undefined}
              closeOnEsc
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ type: 'danger', theme: 'solid' }}
              onCancel={() => { setCbRemoveTarget(undefined) }}
              onOk={() => {
                const target = cbRemoveTarget
                setCbRemoveTarget(undefined)
                if (target === undefined) return
                setUserAccounts(items => {
                  const remaining = items.filter(item => item.id !== target)
                  if (remaining.length === 0) { setCbDemoState('empty'); return items }
                  return remaining.map((item, index) => index === 0 ? { ...item, tag: '当前' } : item)
                })
              }}
            >
              <p>确定删除该账号？其存储的登录凭据将被清除。</p>
              <p className="dsh-semi-showcase-secondary-text">若删除的是当前账号，将自动切换到列表中剩余的第一个账号；删除最后一个账号即退出登录。</p>
            </DshModal>

            {/* 重新登录 Modal：模拟为掉线账号重新走一遍 OAuth，成功后账号恢复在线。 */}
            <DshModal
              title="重新登录"
              visible={cbReloginTarget !== undefined}
              closeOnEsc
              okText="完成登录"
              cancelText="取消"
              onCancel={() => { setCbReloginTarget(undefined) }}
              onOk={() => {
                const target = cbReloginTarget
                setCbReloginTarget(undefined)
                if (target === undefined) return
                setCbExpiredIds(ids => ids.filter(id => id !== target))
                setUserAccounts(items => items.map(item => item.id === target ? { ...item, tag: '当前' } : item))
                DshToast.success({ content: '登录成功：凭据已更新，账号恢复在线' })
              }}
            >
              <div className="dsh-semi-showcase-collapse-create-body">
                <p>
                  即将为「{userAccounts.find(item => item.id === cbReloginTarget)?.name ?? '该账号'}」重新打开浏览器登录。
                  完成授权后该账号的凭据会被替换更新，昵称、UID 与偏好设置保持不变。
                </p>
                <p className="dsh-semi-showcase-secondary-text">演示中点「完成登录」直接恢复在线；实际插件会在此步打开腾讯 CodeBuddy OAuth 页并轮询登录结果。</p>
              </div>
            </DshModal>
    </>
  )
}
