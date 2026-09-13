/**
 * fnOS 原生文件入口：替代 DSH 官方「打开应用」按钮。
 *
 * 为什么遮蔽官方入口：官方按钮按编译期常量表 `OPEN_IN_APP_CATALOG` 探测本机
 * 应用，Linux 上 `zed` 条目只以「PATH 里存在名为 `zed` 的可执行文件」为依据。
 * fnOS 基于 Debian 且启用 ZFS，系统自带 `/usr/sbin/zed`（ZFS Event Daemon），
 * 于是被误判为 Zed 编辑器；而图标提取要求同名 desktop 条目
 * `dev.zed.Zed.desktop`，该文件并不存在，图标路由返回 404。结果就是菜单里出现
 * 一个只有通用字形、点了也打不开编辑器的条目。该常量表不可配置，插件也没有
 * 注册接口，本仓库纪律又禁止提交上游补丁，因此在 fnOS 环境内遮蔽它。
 *
 * 替换成 fnOS 自己的文件能力：`openFileManager(path)` 打开 NAS 文件管理器并
 * 定位到指定路径。菜单项由数组驱动，后续追加 fnOS 文件能力时只需增加一项。
 */

import { useCallback, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: 拉入 ui-session 对 GlobalStandardProps/SessionStandardProps 的合并，
// `useSessions` 与 `sessionId` 才有类型（否则座位标准套件解析成空对象）。
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { DshButton, DshDropdown, DshIconMore } from '@tnnevol/dsh-semi-ui'
import { isEmbeddedFnosFrame } from '../client/services/sdk-carrier.ts'
import { openFnosFileManager } from '../client/services/file-manager.ts'
import { createTrimApp } from '../client/services/sdk.ts'
import type { FnosLocaleKey } from '../client/locales.ts'

type Translate = (key: FnosLocaleKey) => string

/**
 * 从会话列表状态里取工作目录所需的最小形状。
 *
 * `useSessions` 的 selector 参数在本插件的依赖图里解析成 `any`（`ui-session`
 * 的合并只声明了 hook 本身，状态类型来自 `dsh-api-session-controller/client`，
 * 而该包不在本插件的依赖中）。与其为读一个字段而引入整套会话状态类型，这里
 * 显式声明用到的那一层，保持类型检查有效而不是退回 `any`。
 */
interface SessionListStateLike {
  byId: Record<string, { cwd?: string } | undefined>
}

export type FnosOpenInHeaderActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<'settings.dsh-fnos'>
  & { t: Translate }

export function FnosOpenInHeaderAction({ sessionId, useSessions, t }: FnosOpenInHeaderActionProps) {
  const [failed, setFailed] = useState(false)
  const cwd = useSessions((state: SessionListStateLike) => state.byId[String(sessionId)]?.cwd)

  const openFileManager = useCallback(() => {
    if (cwd === undefined || cwd === '') return
    // 失败状态先复位，避免上一次的提示盖住这一次的结果。
    setFailed(false)
    void openFnosFileManager(cwd, () => createTrimApp()).catch(() => { setFailed(true) })
  }, [cwd])

  // 独立浏览器不注册这个入口（注册处已按 iframe 判定），这里再判一次，让组件
  // 被单独渲染时也不会误触发宿主调用。
  if (!isEmbeddedFnosFrame()) return null
  // 工作目录未知时打开没有意义，直接不渲染，避免给出一个必然失败的操作。
  if (cwd === undefined || cwd === '') return null

  return (
    <DshDropdown
      showTick={false}
      position="bottomRight"
      menu={[
        {
          node: 'item',
          name: t('openFileManager'),
          onClick: openFileManager,
        },
      ]}
    >
      <DshButton
        size="default"
        type="primary"
        theme="outline"
        className="dsh-fnos-open-in-button"
        title={failed ? t('openFileManagerFailed') : t('openInFnos')}
        aria-label={t('openInFnosMenu')}
      >
        {t('openInFnos')}
        <span className="dsh-fnos-open-in-button-icon">
          <DshIconMore />
        </span>
      </DshButton>
    </DshDropdown>
  )
}
