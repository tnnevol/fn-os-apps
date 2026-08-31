import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsSource = readFileSync(resolve(import.meta.dirname, '../src/components.ts'), 'utf8')

describe('DSH Semi UI facade', () => {
  it('exports every component family through the shared package', () => {
    const componentExports = [
      'DshButton',
      'DshButtonGroup',
      'DshCheckbox',
      'DshModal',
      'DshProgress',
      'DshTag',
      'DshTree',
      'DshTreeSelect',
      'DshCascader',
      'DshDropdown',
      'DshIconButton',
      'DshHotKeys',
      'DshSpin',
      'DshToast',
      'DshTooltip',
      'DshPopover',
    ] as const

    for (const exportName of componentExports)
      expect(componentsSource).toContain(`export { default as ${exportName} }`)
  })

  it('exports the official icon catalog alongside the DSH aliases', () => {
    expect(componentsSource).toContain("export * as DshSemiIcons from '@douyinfe/semi-icons/lib/es/icons/index.js'")
    expect(componentsSource).toContain('export { default as DshIconRefresh }')
    expect(componentsSource).toContain('export { default as DshIconRestart }')
  })
})
