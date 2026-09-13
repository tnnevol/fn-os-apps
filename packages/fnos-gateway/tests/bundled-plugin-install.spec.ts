import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Bundled-plugin install behaviour in `cmd/install_callback`.
 *
 * `dsh plugin` is a thin pnpm forwarder. For a `file:<archive>` dependency,
 * pnpm treats an unchanged spec as already satisfied, even when the archive at
 * that path was replaced with new bytes. The supported way to force the
 * package to be materialised again is `remove`, followed by `add`.
 *
 * These tests execute the real shell function extracted from the shipped script
 * and record its CLI calls instead of asserting on its source text.
 */

const scriptPath = new URL('../../../apps/fn-deepseek-harness/cmd/install_callback', import.meta.url)

async function functionSource(name: string): Promise<string> {
  const source = await readFile(scriptPath, 'utf8')
  const start = source.indexOf(`${name}() {`)
  if (start < 0) throw new Error(`function ${name} not found in install_callback`)
  const end = source.indexOf('\n}\n', start)
  if (end < 0) throw new Error(`function ${name} is not terminated`)
  return source.slice(start, end + 3)
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function makeProfile(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'fnos-bundled-plugin-'))
  temporaryDirectories.push(root)
  return root
}

/** Run a shell snippet with the real force-install function sourced. */
async function runShell(root: string, body: string): Promise<string> {
  const harness = join(root, 'harness.sh')
  const prelude = [
    '#!/bin/bash',
    `DSH_PROFILE_DIRECTORY=${JSON.stringify(join(root, 'profile'))}`,
    `DSH_BUNDLED_PLUGIN_DIRECTORY=${JSON.stringify(join(root, 'bundled'))}`,
    'fail_install() { printf "FAIL:%s\\n" "$1"; exit 99; }',
    'log_info() { :; }',
    // Record the forwarded CLI call instead of invoking pnpm.
    'run_dsh_plugin() { printf "%s:%s\\n" "$1" "$2"; }',
    await functionSource('force_install_bundled_plugin'),
    body,
  ].join('\n')
  await writeFile(harness, prelude)
  return execFileSync('/bin/bash', [harness], { encoding: 'utf8' })
}

describe('bundled plugin install', () => {
  it('uses force install for bundled archives instead of the version-match skip', async () => {
    const source = await readFile(scriptPath, 'utf8')
    expect(source).toMatch(/force_install_bundled_plugin "\$\{plugin_name\}" "\$\{plugin_version\}" "\$\{bundled_plugin\}" "\$\{current_version\}"/u)
    expect(source).not.toMatch(/Keeping bundled .*exact local version already matches\./u)
  })

  it('removes an installed plugin before adding the FPK archive, even at the same version', async () => {
    const root = await makeProfile()
    const installed = join(root, 'profile', 'node_modules', '@tnnevol', 'dsh-fnos')
    await mkdir(installed, { recursive: true })

    const output = await runShell(root, [
      `force_install_bundled_plugin '@tnnevol/dsh-fnos' '0.1.5-rc.2' '${join(root, 'bundled', 'dsh-fnos.tgz')}' '0.1.5-rc.2'`,
    ].join('\n'))

    expect(output).toContain('remove:@tnnevol/dsh-fnos')
    expect(output).toContain(`add:file:${join(root, 'bundled', 'dsh-fnos.tgz')}`)
    expect(output.indexOf('remove:@tnnevol/dsh-fnos')).toBeLessThan(output.indexOf('add:file:'))
  })

  it('does not remove a missing plugin, but still adds the bundled archive', async () => {
    const root = await makeProfile()
    const archive = join(root, 'bundled', 'dsh-fnos.tgz')
    const output = await runShell(root, [
      `force_install_bundled_plugin '@tnnevol/dsh-fnos' '0.1.5-rc.2' '${archive}' ''`,
    ].join('\n'))

    expect(output).not.toContain('remove:')
    expect(output).toContain(`add:file:${archive}`)
    expect(output).not.toContain('FAIL:')
  })

  it('always adds the FPK archive path, never a registry version', async () => {
    const root = await makeProfile()
    const archive = join(root, 'bundled', 'dsh-fnos.tgz')
    const output = await runShell(root, [
      `force_install_bundled_plugin 'dsh-fnos' '1.0.0' '${archive}' '1.0.0'`,
    ].join('\n'))

    expect(output).toContain(`add:file:${archive}`)
    expect(output).not.toContain('dsh-fnos@1.0.0')
  })
})
