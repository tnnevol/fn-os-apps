/**
 * fnOS 文件管理器图标。
 *
 * 图标由插件自己的路由提供，不走内联 data URL：客户端引用
 * `/fnos-plugins/static/dsh-fnos/file-manager.png`，该前缀同时列在网关的
 * `builtinPaths` 中，浏览器 bridge 会为它补上应用前缀，请求最终落到插件注册的
 * 静态资源路由，由它返回插件包内的 `lib/assets/file-manager.png`。
 *
 * 与官方 `ui-open-in-app` 的做法一致：资源以 URL 引用，而不是编进脚本。这样
 * 图标可以随包更新、被浏览器正常缓存，也不会让客户端 bundle 无谓变大。
 *
 * 命名空间归插件自己所有：它不代理 DSH 的既有路径，也不读取 fnOS 宿主的静态
 * 资源目录（那是宿主未公开的内部布局，随版本可能变动）。
 */

import { FNOS_STATIC_PREFIX } from '../contracts/static-assets-contract.ts'

const FILE_MANAGER_ICON_URL = `${FNOS_STATIC_PREFIX}/file-manager.png`

interface FnosFileManagerIconProps {
  size?: number
  className?: string
}

/** fnOS 文件管理器图标；尺寸由调用方给出（按钮内 15px，菜单行 18px）。 */
export function FnosFileManagerIcon({ size = 15, className }: FnosFileManagerIconProps) {
  return (
    <img
      aria-hidden="true"
      className={['dsh-fnos-file-manager-icon', className].filter(Boolean).join(' ')}
      src={FILE_MANAGER_ICON_URL}
      width={size}
      height={size}
      alt=""
    />
  )
}
