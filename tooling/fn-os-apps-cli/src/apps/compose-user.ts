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
 *
 * 2026-11-16 补充：原实现只检查「写了 `user:` 的行」，于是**没写 `user:` 的应用全部漏检**
 * （`fn-qbittorrent` 等 linuxserver 系列就是这样过的）。真机验证表明这些应用用
 * `PUID=${TRIM_UID}` + `PGID=${TRIM_GID}` 让服务进程降权，写数据目录的 uid 就是包用户，
 * 卸载残留同样为 0，**与 `user:` 等效**。
 *
 * 因此现在的通过条件是「三选一」：
 *   1. `user: ${TRIM_UID}:${TRIM_GID}`；
 *   2. `# USER-EXCEPTION: <原因>` 标记；
 *   3. 同时声明 `PUID=${TRIM_UID}` 与 `PGID=${TRIM_GID}`。
 * 三者都不满足就报警——真正的判据是「写数据目录的进程 uid 是不是包用户」，
 * 而不是「有没有 `user:`」。
 */
export interface ComposeUserReport {
  /** 硬错误：写了 user: 但不是包用户变量、也没有例外标记——这类属于「写错了」，必须修。 */
  errors: string[]
  /** 告警：没写 user: 且没有降权/例外——是真实缺陷但需要逐个真机验证后再改，暂不阻塞 CI。 */
  warnings: string[]
}

export function checkComposeUserMapping(): ComposeUserReport {
  const errors: string[] = []
  const warnings: string[] = []
  for (const app of readFpkApps()) {
    const composePath = join(repositoryRoot, 'apps', app.name, 'app/docker/docker-compose.yaml')
    if (!existsSync(composePath)) continue // 原生应用没有 compose

    let content: string
    let lines: string[]
    try {
      content = readFileSync(composePath, 'utf8')
      lines = content.split(/\r?\n/)
    } catch {
      errors.push(`${app.name}: 无法读取 app/docker/docker-compose.yaml`)
      continue
    }

    const hasUserLine = lines.some(line => /^\s*user:\s*\S/.test(line))
    const hasException = lines.some(line => exceptionMarker.test(line.trim()))

    if (hasUserLine) {
      // 写了 user: 就必须是包用户变量，或在例外标记覆盖范围内
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
      continue
    }

    // 没写 user: 的两种情况：有例外标记（放行），或必须用 PUID/PGID 显式降权
    if (hasException) continue

    const hasPuid = /^\s*-\s*PUID=\$\{TRIM_UID\}/m.test(content)
    const hasPgid = /^\s*-\s*PGID=\$\{TRIM_GID\}/m.test(content)
    if (hasPuid && hasPgid) continue

    // 只记告警：这是真实缺陷（容器以镜像默认身份写数据目录，卸载会留残留），
    // 但修复需要先确认镜像默认身份并按应用真机复测，属于分批推进的存量问题，
    // 现阶段不阻塞 CI。清单与证据见 docs/testing/FNOS-001-image-user-audit-2026-11-05.md。
    // 提示语里的 compose 变量用变量插值生成，避免出现裸的 ${...} 字面量。
    const uidVar = ['$', '{TRIM_UID}'].join('')
    const gidVar = ['$', '{TRIM_GID}'].join('')
    const hint = `请确认后三选一：写 user:、补 PUID=${uidVar}+PGID=${gidVar}、或加 \`# USER-EXCEPTION: 原因\``
    warnings.push(
      `${app.name}: 既未写 user: "${expectedUser}"，也没有 PUID/PGID 降权或 USER-EXCEPTION。`
      + '若该镜像默认以 root 运行，容器创建的数据会属 root、卸载「删除所有数据」会留残留；'
      + hint,
    )
  }
  return { errors, warnings }
}
