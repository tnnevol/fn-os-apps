import { cancel, confirm, isCancel, multiselect, select } from '@clack/prompts'
import { pluginTargets, type PluginTarget } from '../config/targets.js'
import type { FpkApp } from '../config/workspace.js'

export type ReleaseArea = 'project' | 'plugin'
export type BuildSelection = 'plugins' | 'fpk' | 'docs'
export type StartSelection = 'plugins' | 'docs'
export type CheckSelection = 'sdd' | 'docs' | 'packages' | 'plugins'

export async function askReleaseArea(): Promise<ReleaseArea | undefined> {
  const result = await select({
    message: '选择要维护版本的区域',
    options: [
      { value: 'project', label: '项目 / FPK', hint: '根项目、共享包、应用 Manifest 与版本文档' },
      { value: 'plugin', label: 'Harness 插件', hint: '可多选维护插件版本' },
    ],
  })
  if (isCancel(result)) {
    cancel('已取消版本维护')
    return undefined
  }
  return result as ReleaseArea
}

export async function askPlugin(): Promise<PluginTarget[] | undefined> {
  const result = await multiselect({
    message: '选择要维护版本的插件（可多选）',
    required: true,
    options: pluginTargets.map(target => ({ value: target.value, label: target.label })),
  })
  if (isCancel(result)) {
    cancel('已取消版本维护')
    return undefined
  }
  const selected = new Set(result as string[])
  return pluginTargets.filter(target => selected.has(target.value))
}

export async function askCheckSelection(): Promise<CheckSelection[] | undefined> {
  const result = await multiselect({
    message: '选择检查任务（可多选）',
    required: true,
    options: [
      { value: 'sdd', label: 'SDD 文档', hint: '校验需求、计划、编号和内部链接' },
      { value: 'docs', label: '项目文档', hint: '构建 VitePress 文档站点' },
      { value: 'packages', label: '共享包', hint: '通过 Turbo 执行共享包检查' },
      { value: 'plugins', label: 'Harness 插件', hint: '通过 Turbo 执行插件检查' },
    ],
  })
  if (isCancel(result)) {
    cancel('已取消检查')
    return undefined
  }
  return result as CheckSelection[]
}

export async function askBuildSelection(): Promise<BuildSelection[] | undefined> {
  const result = await multiselect({
    message: '选择构建任务（可多选）',
    required: true,
    options: [
      { value: 'plugins', label: 'Harness 插件', hint: '通过 Turbo 构建插件及其共享包依赖' },
      { value: 'fpk', label: 'fnOS FPK', hint: '可继续多选应用，DSH 应用自动先构建网关' },
      { value: 'docs', label: '项目文档', hint: '构建 VitePress 文档站点' },
    ],
  })
  if (isCancel(result)) {
    cancel('已取消构建')
    return undefined
  }
  return result as BuildSelection[]
}

export async function askStartSelection(): Promise<StartSelection[] | undefined> {
  const result = await multiselect({
    message: '选择启动任务（可多选）',
    required: true,
    options: [
      { value: 'plugins', label: 'Harness 插件', hint: '通过 Turbo watch 编译插件及其共享包依赖' },
      { value: 'docs', label: '项目文档', hint: '启动 VitePress 文档开发服务' },
    ],
  })
  if (isCancel(result)) {
    cancel('已取消启动')
    return undefined
  }
  return result as StartSelection[]
}

export async function askPlugins(): Promise<string[] | undefined> {
  const result = await multiselect({
    message: '选择要编译的插件（可多选）',
    required: true,
    options: pluginTargets.map(target => ({ value: target.filter, label: target.label })),
  })
  if (isCancel(result)) {
    cancel('已取消插件构建')
    return undefined
  }
  return result as string[]
}

export async function askPublishPlugins(): Promise<PluginTarget[] | undefined> {
  const result = await multiselect({
    message: '选择要发布的 npm 插件（可多选）',
    required: true,
    options: pluginTargets.map(target => ({ value: target.value, label: target.label })),
  })
  if (isCancel(result)) {
    cancel('已取消 npm 发布')
    return undefined
  }
  const selected = new Set(result as string[])
  return pluginTargets.filter(target => selected.has(target.value))
}

export async function askFpkApps(apps: FpkApp[]): Promise<FpkApp[] | undefined> {
  const result = await multiselect({
    message: '选择要编译的 FPK 应用（可多选）',
    required: true,
    options: apps.map(app => ({
      value: app.name,
      label: app.label,
      ...(app.requiresGateway ? { hint: '自动先编译 fnOS Gateway' } : {}),
    })),
  })
  if (isCancel(result)) {
    cancel('已取消 FPK 构建')
    return undefined
  }
  const selected = new Set(result as string[])
  return apps.filter(app => selected.has(app.name))
}

export async function askBundleDshPlugins(): Promise<boolean | undefined> {
  const result = await confirm({
    message: '是否将 Harness 清单插件内置到 FPK 包中？',
    initialValue: true,
  })
  if (isCancel(result)) {
    cancel('已取消 FPK 构建')
    return undefined
  }
  return result
}
