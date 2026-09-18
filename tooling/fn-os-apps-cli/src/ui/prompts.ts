import { cancel, isCancel, multiselect } from '@clack/prompts'
import type { FpkApp } from '../config/workspace.js'

export type BuildSelection = 'fpk' | 'docs'
export type CheckSelection = 'sdd' | 'docs'

/**
 * 多选提示，只有一个可选值时跳过询问。
 *
 * 只剩一个选项时没有可选择的余地，弹一个只有一行的多选框更像是在要求确认，
 * 而不是在做选择，因此直接返回该选项。没有任何选项时返回空数组，调用方按
 * “什么都没选”处理。
 *
 * 值类型固定为 `string`：`@clack/prompts` 的 `Option<Value>` 是条件类型，
 * 传入未实例化的泛型参数时 TS 无法判定可赋值性。
 */
async function chooseMany(
  message: string,
  options: Array<{ value: string, label: string, hint?: string }>,
  cancelMessage: string,
): Promise<string[] | undefined> {
  const only = options.length === 1 ? options[0] : undefined
  if (only !== undefined) return [only.value]
  if (options.length === 0) return []

  const result = await multiselect({ message, required: true, options })
  if (isCancel(result)) {
    cancel(cancelMessage)
    return undefined
  }
  return result
}

export async function askCheckSelection(): Promise<CheckSelection[] | undefined> {
  return await chooseMany('选择检查任务（可多选）', [
    { value: 'sdd', label: 'SDD 文档', hint: '校验需求、计划、编号和内部链接' },
    { value: 'docs', label: '项目文档', hint: '构建 VitePress 文档站点' },
  ], '已取消检查') as CheckSelection[] | undefined
}

export async function askBuildSelection(): Promise<BuildSelection[] | undefined> {
  return await chooseMany('选择构建任务（可多选）', [
    { value: 'fpk', label: 'fnOS FPK', hint: '可继续多选应用' },
    { value: 'docs', label: '项目文档', hint: '构建 VitePress 文档站点' },
  ], '已取消构建') as BuildSelection[] | undefined
}

export async function askFpkApps(apps: FpkApp[]): Promise<FpkApp[] | undefined> {
  const names = await chooseMany(
    '选择要编译的 FPK 应用（可多选）',
    apps.map(app => ({ value: app.name, label: app.label })),
    '已取消 FPK 构建',
  )
  if (names === undefined) return undefined
  const selected = new Set(names)
  return apps.filter(app => selected.has(app.name))
}
