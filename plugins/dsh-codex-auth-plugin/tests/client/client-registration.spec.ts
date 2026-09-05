import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('dsh-codex-auth-plugin client registration', () => {
  it('registers a Codex settings section instead of a plugin-list card', async () => {
    const client = await readFile(new URL('../../src/client/index.tsx', import.meta.url), 'utf8')
    expect(client).toContain("ctx.slots.inject('settings.section'")
    expect(client).toContain("name: 'settings.section'")
    expect(client).toContain("id: 'codex-auth'")
    expect(client).toContain('label: () => t(\'title\')')
    expect(client).toContain("CodexAuthSection")
    expect(client).not.toContain("settings.plugin.item")
    expect(client).not.toContain("installCodexModelEditorPresentation")
    expect(client).toContain("installSemiDshTheme(), 'dsh-codex-auth-plugin: Semi DSH theme'")
    expect(client).toContain("'connection', 'remote', 'remote.session', 'settingsScope'")
    expect(client).toContain('const remote = ctx.remote as unknown')
    expect(client).toContain('decodeCodexAuthSettings')
    expect(client).toContain('configScope')
  })

  it('no longer patches the official Models page with a Codex editor', async () => {
    const files = [
      '../../src/components/CodexAuthSection.tsx',
      '../../src/client/index.tsx',
    ]
    for (const file of files) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8')
      expect(source).not.toContain('model-editor-presentation')
      expect(source).not.toContain('data-dsh-codex-auth-editor')
    }
  })

  it('keeps the composer quota readout registered at the input right', async () => {
    const client = await readFile(new URL('../../src/client/index.tsx', import.meta.url), 'utf8')
    const status = await readFile(new URL('../../src/components/CodexUsageStatus.tsx', import.meta.url), 'utf8')
    const style = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    expect(client).toContain("ctx.slots.inject('conversation.input.right'")
    expect(client).toContain("name: 'conversation.input.right'")
    expect(client).toContain("id: 'codex-usage'")
    expect(client).not.toContain("ctx.slots.inject('conversation.composer.dock'")
    expect(status).toContain('compactUsageWindow(usage)')
    expect(status).toContain('fiveHourWindow(usage)')
    expect(status).toContain('weeklyWindow(usage)')
    expect(status).toContain("if (accountState === 'signed-out') return null")
    expect(status).toContain('DshPopover')
    expect(status).toContain('trigger="custom"')
    expect(status).toContain('dsh-codex-usage-popover-trigger')
    expect(style).toContain('.dsh-codex-usage-progress-track')
    expect(style).toContain('color: var(--dsw-alias-label-primary)')
  })

  it('does not render usage quota blocks inside the settings section', async () => {
    const section = await readFile(new URL('../../src/components/CodexAuthSection.tsx', import.meta.url), 'utf8')
    expect(section).toContain('dsh-codex-auth-section')
    expect(section).toContain('CODEX_AUTH_STATUS_PATH')
    expect(section).not.toContain('usageTitle')
    expect(section).not.toContain('CODEX_USAGE_PATH')
    expect(section).not.toContain('UsageWindowView')
    expect(section).not.toContain('remainingPercent')
    expect(section).not.toContain('dsh-codex-auth-usage')
  })

  it('keeps model refresh and the global model picker in the settings section', async () => {
    const section = await readFile(new URL('../../src/components/CodexAuthSection.tsx', import.meta.url), 'utf8')
    expect(section).toContain('<CodexGlobalModel')
    expect(section).toContain('catalogRefreshKey={catalogRefreshKey}')
    expect(section).toContain('CODEX_MODEL_REFRESH_PATH')
    expect(section).toContain('refreshModels')
    expect(section).toContain('<CodexCapabilities')
  })

  it('uses Semi Cascader multi-select and keeps it open after leaf clicks', async () => {
    const picker = await readFile(new URL('../../src/components/CodexGlobalModel.tsx', import.meta.url), 'utf8')
    const style = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    expect(picker).toContain("import { DshButton, DshCascader } from '@tnnevol/dsh-semi-ui'")
    expect(picker).toContain('<DshCascader')
    expect(picker).toContain('multiple')
    expect(picker).toContain('enableLeafClick')
    expect(picker).toContain('changeOnSelect={false}')
    expect(picker).not.toContain('onSelect={reopenAfterSelect}')
    expect(picker).not.toContain('cascaderRef.current?.open?.()')
    expect(style).toContain('min-width: 252px')
    expect(style).toContain('border-radius: 10px')
    expect(picker).toContain('dropdownClassName="dsh-codex-global-model-cascader"')
    expect(picker).toContain('const treeData = [')
    expect(picker).toContain('const UNSET_VALUE')
    expect(picker).toContain("t('cancel')")
  })

  it('uses pill actions and compact lower actions in the Codex settings section', async () => {
    const section = await readFile(new URL('../../src/components/CodexAuthSection.tsx', import.meta.url), 'utf8')
    const capabilities = await readFile(new URL('../../src/components/CodexCapabilities.tsx', import.meta.url), 'utf8')
    const globalModel = await readFile(new URL('../../src/components/CodexGlobalModel.tsx', import.meta.url), 'utf8')
    const style = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    expect(section).toContain('theme="solid" type="primary"')
    expect(capabilities).toContain('type="secondary" size="small"')
    expect(capabilities).toContain('type="primary" size="small"')
    expect(globalModel).toContain('type="secondary" size="small"')
    expect(globalModel).toContain('type="primary" size="small"')
    expect(style).toContain('.dsh-codex-auth-section .semi-button')
    expect(style).not.toContain('border-radius: 7px')
    expect(style).toContain('border-radius: var(--semi-border-radius-full)')
  })

  it('matches the DSH settings surface in both color modes', async () => {
    const section = await readFile(new URL('../../src/components/CodexAuthSection.tsx', import.meta.url), 'utf8')
    const style = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    expect(section).toContain('dsh-codex-auth-section')
    expect(style).toContain('var(--dsw-alias-label-primary)')
    expect(style).toContain('var(--dsw-alias-label-secondary)')
    expect(style).toContain('var(--dsw-alias-border-l2)')
  })

  it('exposes image upload alongside image recognition', async () => {
    const capabilities = await readFile(new URL('../../src/components/CodexCapabilities.tsx', import.meta.url), 'utf8')
    const locales = await readFile(new URL('../../src/client/locales.ts', import.meta.url), 'utf8')
    expect(capabilities).toContain('enableImageUpload')
    expect(capabilities).toContain('updateImageUpload')
    expect(capabilities).toContain("t('enableImageUpload')")
    expect(locales).toContain('启用图片上传')
  })
})
