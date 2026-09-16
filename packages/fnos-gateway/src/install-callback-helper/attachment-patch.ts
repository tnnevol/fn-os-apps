import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { readJsonStrict } from './common.ts'
import { createLogger, fail } from './logger.ts'

const logger = createLogger('dsh-attachment-local-patch')
const PATCH_MARKER = 'fnOS patch: attachment-local uses TRIM_PKGVAR boundary v1'

function replaceOnce(source: string, before: string, after: string, label: string): string {
  const count = source.split(before).length - 1
  if (count !== 1) return fail('dsh-attachment-local-patch', `${label} expected one match, found ${count}`)
  return source.replace(before, after)
}

async function atomicWrite(path: string, source: string): Promise<void> {
  const temporary = `${path}.fnos-patch.tmp`
  await writeFile(temporary, source, 'utf8')
  try {
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

export async function patchDshAttachmentLocal(): Promise<void> {
  const packageDirectory = process.env.DSH_ATTACHMENT_LOCAL_DIR
  const expectedPackageVersion = process.env.DSH_ATTACHMENT_LOCAL_VERSION
  const durabilityBoundary = String(process.env.TRIM_PKGVAR || '').trim()
  if (!packageDirectory) return fail('dsh-attachment-local-patch', 'DSH_ATTACHMENT_LOCAL_DIR is required')
  if (!expectedPackageVersion) return fail('dsh-attachment-local-patch', 'DSH_ATTACHMENT_LOCAL_VERSION is required')
  if (!isAbsolute(durabilityBoundary)) return fail('dsh-attachment-local-patch', 'TRIM_PKGVAR must be an absolute path')

  const packageJsonPath = join(packageDirectory, 'package.json')
  const packageJson = await readJsonStrict(packageJsonPath)
  if (packageJson.name !== '@deepseek-ai/dsh-attachment-local') {
    return fail('dsh-attachment-local-patch', `unexpected package name: ${String(packageJson.name || '(missing)')}`)
  }
  if (packageJson.version !== expectedPackageVersion) {
    return fail('dsh-attachment-local-patch', `expected @deepseek-ai/dsh-attachment-local@${expectedPackageVersion}, found ${String(packageJson.version || '(missing)')}`)
  }

  const indexPath = join(packageDirectory, 'lib', 'index.js')
  let source = await readFile(indexPath, 'utf8')
  if (source.includes(PATCH_MARKER)) {
    logger.info(`Already patched @deepseek-ai/dsh-attachment-local@${String(packageJson.version)}.`)
    return
  }

  source = replaceOnce(
    source,
    'import { dirname, join, parse, resolve } from "node:path";',
    'import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";',
    'path imports',
  )
  source = replaceOnce(
    source,
    'async function ensureDurableHome(path) {\n\tconst home = resolve(path);\n\tif (!durableHomes.has(home)) {\n\t\tawait ensureDurableDirectory(home, parse(home).root);\n\t\tdurableHomes.add(home);\n\t}\n\treturn home;\n}',
    `/* ${PATCH_MARKER} */
function attachmentDurabilityBoundary(home) {
\tconst boundary = resolve(process.env.TRIM_PKGVAR)
\tconst fromBoundary = relative(boundary, home)
\tif (fromBoundary !== '' && (fromBoundary.startsWith('..') || isAbsolute(fromBoundary))) {
\t\tthrow new Error('attachment-local: TRIM_PKGVAR is not an ancestor of the attachment home: ' + boundary)
\t}
\treturn boundary
}
async function ensureDurableHome(path) {
\tconst home = resolve(path)
\tif (!durableHomes.has(home)) {
\t\tawait ensureDurableDirectory(home, attachmentDurabilityBoundary(home))
\t\tdurableHomes.add(home)
\t}
\treturn home
}`,
    'durability boundary',
  )
  source = replaceOnce(
    source,
    'this.root = resolve(join(resolveDshHome(config.dshHome), "attachments", "v1"));',
    `/* ${PATCH_MARKER} */
\tconst attachmentHome = process.env.TRIM_PKGVAR || config.dshHome
\tthis.root = resolve(join(resolveDshHome(attachmentHome), "attachments", "v1"));`,
    'attachment root',
  )

  await atomicWrite(indexPath, source)
  logger.info(`Patched @deepseek-ai/dsh-attachment-local@${String(packageJson.version)}; attachment root and durability boundary use TRIM_PKGVAR.`)
}
