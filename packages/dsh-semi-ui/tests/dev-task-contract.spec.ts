import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

type TaskConfig = {
  dependsOn?: string[]
  persistent?: boolean
  interruptible?: boolean
}

async function readJson<T>(url: URL): Promise<T> {
  return JSON.parse(await readFile(url, 'utf8')) as T
}

describe('shared UI dev task contract', () => {
  it('orders plugin dev after the shared UI dev instead of starting them in parallel', async () => {
    const root = await readJson<{ tasks: Record<string, TaskConfig> }>(new URL('../../../turbo.json', import.meta.url))

    // 插件 bundle 需要解析 @tnnevol/dsh-semi-ui/lib/index.js；并行启动会让共享包的
    // clean 删除 lib/，插件侧报 Could not resolve。必须通过 ^dev 表达依赖顺序。
    expect(root.tasks.dev?.dependsOn ?? []).toContain('^dev')
    expect(root.tasks.dev?.dependsOn ?? []).not.toContain('^build')
    expect(root.tasks.dev?.persistent).toBe(true)
  })

  it('keeps shared UI dev a one-shot task so a persistent consumer may depend on it', async () => {
    const pkg = await readJson<{ scripts: Record<string, string> }>(new URL('../package.json', import.meta.url))
    const override = await readJson<{ extends: string[], tasks: Record<string, TaskConfig> }>(
      new URL('../turbo.json', import.meta.url),
    )

    // Turbo 不允许 persistent 任务被依赖，因此共享包 dev 必须是会结束的一次性构建。
    expect(override.extends).toEqual(['//'])
    expect(override.tasks.dev?.persistent).toBe(false)
    expect(override.tasks.dev?.interruptible).toBe(false)
    expect(pkg.scripts.dev).toBe('tsdown')
    expect(pkg.scripts.dev).not.toContain('--watch')
  })
})
