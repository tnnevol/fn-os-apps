import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'
import { readFpkApps } from '../config/workspace.js'

/** 唯一允许的运行身份写法：包用户（真机已确认该变量在 compose 中可展开）。 */
// eslint-disable-next-line no-template-curly-in-string -- compose 变量字面量，不是模板串
const expectedUser = '${TRIM_UID}:${TRIM_GID}'

/** 例外标记：确需 root 的镜像必须显式写明原因，避免「顺手写死 uid」被当成正常。 */
const exceptionMarker = /^#\s*USER-EXCEPTION:\s*\S/

/** 例外标记允许出现在 `user:` 行上方多少行以内（注释块常有多行）。 */
const markerLookback = 12

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '')
}

/**
 * 校验每个 Docker 应用的运行身份写法。
 *
 * 背景（2026-11-05 真机结论）：容器不写 `user:` 时以镜像默认 root 运行，会把数据写成
 * root 属主，卸载回调以包用户运行删不掉，用户选「删除所有数据」后仍留残留。写死任何
 * 数字 uid 也不行——包用户 uid 是安装时动态分配的，且容器新建子目录的权限位会吃掉继承
 * 的 ACL。唯一可靠写法是平台注入的 `TRIM_UID`/`TRIM_GID`；确需 root 的镜像必须打
 * `# USER-EXCEPTION:` 标记并写明原因。
 */
export function checkComposeUserMapping(): string[] {
  const errors: string[] = []
  for (const app of readFpkApps()) {
    const composePath = join(repositoryRoot, 'apps', app.name, 'app/docker/docker-compose.yaml')
    if (!existsSync(composePath)) continue // 原生应用没有 compose

    let lines: string[]
    try {
      lines = readFileSync(composePath, 'utf8').split(/\r?\n/)
    } catch {
      errors.push(`${app.name}: 无法读取 app/docker/docker-compose.yaml`)
      continue
    }

    lines.forEach((line, index) => {
      const match = /^\s*user:\s*(.+?)\s*(?:#.*)?$/.exec(line)
      if (match === null) return

      const value = stripQuotes(match[1] ?? '')
      if (value === expectedUser) return

      const hasMarker = lines
        .slice(Math.max(0, index - markerLookback), index)
        .some(candidate => exceptionMarker.test(candidate.trim()))
      if (hasMarker) return

      errors.push(
        `${app.name}: user 必须写成 "${expectedUser}"（当前 "${value}"）；`
        + '确需 root 的镜像请在 user: 上方加 `# USER-EXCEPTION: 原因`',
      )
    })
  }
  return errors
}
