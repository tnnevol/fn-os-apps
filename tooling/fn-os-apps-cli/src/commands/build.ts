import { statSync } from 'node:fs'
import { join } from 'node:path'
import { type OptionValues } from 'commander'
import { program } from '../program.js'
import { repositoryRoot } from '../config/paths.js'
import { readFpkApps, type FpkApp } from '../config/workspace.js'
import { runDocsBuild } from './docs.js'
import { addBooleanArgs } from '../core/command-args.js'
import { runCommand } from '../core/process.js'
import { askBuildSelection, askFpkApps } from '../ui/prompts.js'

/**
 * 判断 `fnpack build` 是否真的产出了本次构建的 `.fpk`。
 *
 * `fnpack` 在打包失败时（缺 `manifest`、非法 `app/ui/config`、
 * 非法 `config/privilege` 等）会打印 `Packing failed...` 却**仍返回退出码 0**，
 * 且不生成 `.fpk`。实测 1.2.0、1.2.3、1.2.4 均如此（CI 使用的
 * `fnpack-1.2.1-linux-amd64` 自报 Version 1.2.0，同样复现）。
 * 只按退出码判定会把打包失败误报为成功，因此这里额外要求产物存在，
 * 并且修改时间不早于本次构建开始时间（排除上次的残留产物）。
 */
function fpkProduced(appDir: string, appname: string, startedAt: number): boolean {
  const fpkPath = join(appDir, `${appname}.fpk`)
  try {
    return statSync(fpkPath).mtimeMs >= startedAt
  }
  catch {
    return false
  }
}

async function buildFpkApps(apps: FpkApp[]): Promise<void> {
  const failures: string[] = []
  for (const app of apps) {
    console.log(`\nBuilding FPK: ${app.name}`)
    const appDir = join(repositoryRoot, 'apps', app.name)
    const startedAt = Date.now()
    try {
      await runCommand('fnpack', ['build'], appDir)
    }
    catch (error) {
      failures.push(`${app.name}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    if (!fpkProduced(appDir, app.name, startedAt)) {
      console.error(`fnpack reported success but ${app.name}.fpk was not produced; treating as build failure.`)
      failures.push(`${app.name}: fnpack exited with code 0 but ${app.name}.fpk was not produced`)
    }
  }

  // 汇总后一次性失败，避免多应用构建时首个失败掩盖其余结果。
  if (failures.length > 0) {
    throw new Error(`FPK build failed for ${failures.length} application(s):\n- ${failures.join('\n- ')}`)
  }
}

async function selectFpkApps(app?: string): Promise<FpkApp[] | undefined> {
  const apps = readFpkApps()
  if (app !== undefined) {
    const selected = apps.find(candidate => candidate.name === app)
    if (selected === undefined) throw new Error(`Unknown FPK application: ${app}`)
    return [selected]
  }
  return askFpkApps(apps)
}

export async function runBuild(args: string[]): Promise<void> {
  const app = args.includes('--app') ? args[args.indexOf('--app') + 1] : undefined
  if (args.includes('--fpk')) {
    const apps = await selectFpkApps(app)
    if (apps !== undefined) await buildFpkApps(apps)
    return
  }
  if (args.includes('--docs')) {
    await runDocsBuild()
    return
  }

  const selection = await askBuildSelection()
  if (selection === undefined) return

  const fpkApps = selection.includes('fpk') ? await selectFpkApps() : undefined
  const tasks: Promise<void>[] = []
  if (fpkApps !== undefined) tasks.push(buildFpkApps(fpkApps))
  if (selection.includes('docs')) tasks.push(runDocsBuild())
  await Promise.all(tasks)
}

program
  .command('build')
  .description('Select FPK applications or documentation to build')
  .option('--fpk', 'build FPK applications')
  .option('--app <app>', 'select one FPK application')
  .option('--docs', 'build documentation')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addBooleanArgs(args, options, ['fpk', 'docs'])
    if (options.app !== undefined) args.push('--app', options.app)
    await runBuild(args)
  })
