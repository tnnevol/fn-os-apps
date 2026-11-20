/**
 * 打包前把 manifest 的版本号同步到 app/server/version.txt。
 *
 * fnpack 不会把 manifest 装到设备上，后端需要一份随包分发的版本文档
 * 才能报告真实运行版本。版本号只在 manifest 里维护一处，这里自动同步，
 * 避免两处不一致。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = import.meta.dirname
const manifest = readFileSync(join(root, 'manifest'), 'utf8')
const version = /^version\s*=\s*(.+)$/m.exec(manifest)?.[1]?.trim()

if (!version) {
  console.error('manifest 中没有 version 字段')
  process.exit(1)
}

writeFileSync(join(root, 'app/server/version.txt'), `${version}\n`)
console.log(`version.txt -> ${version}`)
