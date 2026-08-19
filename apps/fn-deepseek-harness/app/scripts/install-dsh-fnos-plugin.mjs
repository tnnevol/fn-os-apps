#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const PACKAGE_NAME = '@tnnevol/dsh-fnos'
const sourceDir = process.env.DSH_FNOS_PLUGIN_SOURCE
const profileDir = process.env.DSH_FNOS_PROFILE_DIRECTORY

function fail(message) {
  console.error(`[dsh-fnos] ${message}`)
  process.exitCode = 1
}

if (!sourceDir || !profileDir) {
  fail('plugin source or web profile directory is not configured')
} else {
  const sourceManifestPath = join(sourceDir, 'package.json')
  const sourceManifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'))
  if (sourceManifest.name !== PACKAGE_NAME) {
    fail(`unexpected bundled plugin name: ${String(sourceManifest.name)}`)
  } else {
    const targetDir = join(profileDir, 'node_modules', ...PACKAGE_NAME.split('/'))
    await mkdir(dirname(targetDir), { recursive: true })
    await rm(targetDir, { recursive: true, force: true })
    await cp(sourceDir, targetDir, { recursive: true, force: true })

    const profileManifestPath = join(profileDir, 'package.json')
    const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
    const bundles = Array.isArray(profileManifest.dsh?.profile?.bundles)
      ? [...profileManifest.dsh.profile.bundles]
      : []
    if (!bundles.includes(PACKAGE_NAME)) bundles.push(PACKAGE_NAME)
    profileManifest.dsh = {
      ...(profileManifest.dsh ?? {}),
      profile: {
        ...(profileManifest.dsh?.profile ?? {}),
        bundles,
      },
    }
    await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`)
    console.log(`Installed bundled ${PACKAGE_NAME} ${sourceManifest.version} into the web profile.`)
  }
}
