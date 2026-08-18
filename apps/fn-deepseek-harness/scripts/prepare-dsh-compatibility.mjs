#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const appScript = resolve(dirname(fileURLToPath(import.meta.url)), '../app/scripts/prepare-dsh-compatibility.mjs')
const result = spawnSync(process.execPath, [appScript, ...process.argv.slice(2)], { stdio: 'inherit' })

if (result.error !== undefined) throw result.error
process.exit(result.status ?? 1)
