#!/usr/bin/env node

import { isAbsolute, join, relative, resolve } from 'node:path'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'

const packageDirectory = process.env.DSH_ATTACHMENT_LOCAL_DIR
const expectedPackageVersion = process.env.DSH_ATTACHMENT_LOCAL_VERSION
const durabilityBoundary = String(process.env.TRIM_PKGVAR || '').trim()
const PATCH_MARKER = 'fnOS patch: attachment-local uses TRIM_PKGVAR boundary v1'

function fail(message) {
  throw new Error(`[dsh-attachment-local-patch] ${message}`)
}

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) fail(`${label} expected one match, found ${count}`)
  return source.replace(before, after)
}

async function atomicWrite(path, source) {
  const temporary = `${path}.fnos-patch.tmp`
  await writeFile(temporary, source, 'utf8')
  try {
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

async function main() {
  if (!packageDirectory) fail('DSH_ATTACHMENT_LOCAL_DIR is required')
  if (!expectedPackageVersion) fail('DSH_ATTACHMENT_LOCAL_VERSION is required')
  if (!isAbsolute(durabilityBoundary)) fail('TRIM_PKGVAR must be an absolute path')

  const packageJsonPath = join(packageDirectory, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  if (packageJson.name !== '@deepseek-ai/dsh-attachment-local') {
    fail(`unexpected package name: ${packageJson.name || '(missing)'}`)
  }
  if (packageJson.version !== expectedPackageVersion) {
    fail(`expected @deepseek-ai/dsh-attachment-local@${expectedPackageVersion}, found ${packageJson.version || '(missing)'}`)
  }

  const indexPath = join(packageDirectory, 'lib', 'index.js')
  let source = await readFile(indexPath, 'utf8')
  if (source.includes(PATCH_MARKER)) {
    console.log(`Already patched @deepseek-ai/dsh-attachment-local@${packageJson.version}.`)
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
  console.log(`Patched @deepseek-ai/dsh-attachment-local@${packageJson.version}; attachment root and durability boundary use TRIM_PKGVAR.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
