#!/usr/bin/env node

import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryDirectory = resolve(scriptDirectory, '../../..')
const pluginDefinitions = [
  {
    sourceDirectory: resolve(repositoryDirectory, 'plugins/dsh-fnos-plugin'),
    targetDirectory: resolve(scriptDirectory, '../app/plugins/dsh-fnos'),
  },
]
const packageFiles = ['package.json', 'compatibility.json', 'cordis.patch.yml', 'README.md']

for (const { sourceDirectory, targetDirectory } of pluginDefinitions) {
  const sourceManifest = JSON.parse(await readFile(resolve(sourceDirectory, 'package.json'), 'utf8'))
  if (typeof sourceManifest.name !== 'string' || sourceManifest.name.length === 0) {
    throw new Error(`Bundled DSH plugin has no package name: ${sourceDirectory}`)
  }

  await rm(targetDirectory, { recursive: true, force: true })
  await mkdir(targetDirectory, { recursive: true })
  for (const filename of packageFiles) {
    await cp(resolve(sourceDirectory, filename), resolve(targetDirectory, filename))
  }
  await cp(resolve(sourceDirectory, 'lib'), resolve(targetDirectory, 'lib'), { recursive: true })

  for (const filename of ['lib/index.js', 'lib/client.js']) {
    await readFile(resolve(targetDirectory, filename))
  }

  console.log(`Staged ${sourceManifest.name} ${sourceManifest.version} in ${targetDirectory}`)
}

// Older local builds staged the published plugin into the FPK. Remove that
// generated directory; published plugins are installed from npm at runtime.
await rm(resolve(scriptDirectory, '../app/plugins/dsh-codex-auth'), { recursive: true, force: true })
