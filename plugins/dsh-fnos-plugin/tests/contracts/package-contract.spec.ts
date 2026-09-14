import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('dsh-fnos package contract', () => {
  it('declares the remote session namespace before using it', async () => {
    const source = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')

    expect(source).toMatch(/export const inject = \[[\s\S]*'remote', 'remote\.session'/u)
    expect(source).toContain('ctx.remote.session')
  })

  it('registers fn through DSH commandUi and keeps directory browsing as input completion', async () => {
    const source = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')
    const slashSource = await readFile(new URL('../../src/client/input-references/fnos-command-source.ts', import.meta.url), 'utf8')
    expect(source).toContain('createFnosDirectorySource')
    expect(source).toContain('registerSource(directorySource)')
    expect(source).toContain('createFnosCommandContribution')
    expect(source).toContain('commandUi.register')
    expect(source).toContain("'commandUi'")
    expect(slashSource).toContain("trigger: '/'" )
    expect(slashSource).toContain("name: 'fnos-directory'")
    expect(slashSource).toContain("action === 'drill'")
    expect(slashSource).toContain('requestAuthorizedEntries')
    expect(slashSource).not.toContain('commandCandidate')
  })

  it('declares a bundle and an early web client with theme ordering', async () => {
    const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
      name: string
      version: string
      dsh: { bundle: { patch: string }, client: { platform: string, immediately: boolean, inject: string[] } }
      devDependencies: { '@trimjs/web-app': string, '@tnnevol/dsh-semi-ui': string }
    }
    expect(manifest.name).toBe('@tnnevol/dsh-fnos')
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u)
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.immediately).toBe(true)
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-theme')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-commands')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-workspace')
    expect(manifest.dsh.client.inject).not.toContain('@deepseek-ai/dsh-client-ui-directory-picker-browse')
    expect(manifest.devDependencies['@trimjs/web-app']).toBe('catalog:')
    expect(manifest.devDependencies['@tnnevol/dsh-semi-ui']).toBe('workspace:*')
  })

  it('does not block fnOS routes on the optional ApiProxy service', async () => {
    const source = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/export const inject = \['webServer', 'settings'\]/u)
    expect(source).not.toMatch(/export const inject = \['webServer', 'settings', 'apiProxy'\]/u)
  })

  it('only registers itself and does not patch the official directory picker', async () => {
    const patch = await readFile(new URL('../../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).toContain('id: dsh-fnos')
    expect(patch).toContain("name: '@tnnevol/dsh-fnos'")
    expect(patch).not.toContain('directory-picker')
    expect(patch).not.toContain('@deepseek-ai/dsh-host-directory-picker-browse')
  })

  it('keeps the fnOS settings card after the built-in keyed cards', async () => {
    const source = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/key:\s*'dsh-fnos-authorized-directories'[\s\S]{0,160}priority:\s*100/u)
    expect(source).toContain("ctx.slots.inject('sidebar.footer.action'")
    expect(source).toContain("id: 'dsh-fnos-web-restart'")
    expect(source).toContain('installFnosBrowserRefreshShortcut')
    const restart = await readFile(new URL('../../src/components/FnosWebRestartAction.tsx', import.meta.url), 'utf8')
    expect(restart).toContain('DshButtonGroup')
    expect(restart).toContain('DshIconRefresh2')
    expect(restart).toContain('DshIconSync')
    expect(restart).toContain('spin={busy}')
    expect(restart).toContain('window.location.reload()')
    expect(restart).toContain("aria-label={refreshLabel}")
    expect(restart).toContain('/__fnos-gateway/control/web/restart')
    expect(restart).toContain('isEmbeddedFnosFrame')
    expect(restart).toContain('dsh-fnos-web-refresh')
    const refreshShortcut = await readFile(new URL('../../src/client/shortcuts/browser-refresh-shortcut.ts', import.meta.url), 'utf8')
    expect(refreshShortcut).toContain('DshHotKeys')
    expect(refreshShortcut).toContain('DshHotKeys.Keys.F5')
    expect(refreshShortcut).toContain('DshHotKeys.Keys.Control')
    expect(refreshShortcut).toContain('DshHotKeys.Keys.Meta')
    expect(refreshShortcut).toContain('getListenerTarget: () => window')
    expect(refreshShortcut).toContain('event.preventDefault()')
    expect(refreshShortcut).toContain('window.location.reload()')
    const refreshShortcutMatcher = await readFile(new URL('../../src/client/shortcuts/browser-refresh-shortcut-matcher.ts', import.meta.url), 'utf8')
    expect(refreshShortcutMatcher).toContain("event.key === 'F5'")
    expect(refreshShortcutMatcher).toContain("event.key.toLowerCase() === 'r'")
    const settingsShortcut = await readFile(new URL('../../src/client/shortcuts/settings-shortcut.ts', import.meta.url), 'utf8')
    expect(settingsShortcut).toContain('DshHotKeys')
    expect(settingsShortcut).toContain('DshHotKeys.Keys.Control')
    expect(settingsShortcut).toContain('DshHotKeys.Keys.Meta')
    expect(settingsShortcut).toContain('DshHotKeys.Keys.Comma')
    expect(settingsShortcut).toContain('[data-slot="sidebar.settings"] button[aria-haspopup="dialog"]')
    expect(settingsShortcut).toContain('trigger.click()')
    expect(settingsShortcut).toContain('event.preventDefault()')
    expect(source).toContain('installFnosSettingsShortcut')
  })

  it('keeps the cancel-authorization label stable while adding a directory', async () => {
    const source = await readFile(new URL('../../src/components/AuthorizedDirectoriesCard.tsx', import.meta.url), 'utf8')
    expect(source).toContain("{t('delete')}")
    expect(source).not.toContain("{busy ? t('deleting') : t('delete')}")
  })

  it('adapts opening the DSH settings document to fnOS', async () => {
    const host = await readFile(new URL('../../src/host/authorized-directories.ts', import.meta.url), 'utf8')
    const action = await readFile(new URL('../../src/components/FnosSettingsDocumentAction.tsx', import.meta.url), 'utf8')
    const style = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    const contract = await readFile(new URL('../../src/contracts/settings-document-contract.ts', import.meta.url), 'utf8')
    const index = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')
    expect(host).toContain('ctx.settings.prepareDocument()')
    expect(host).toContain('FNOS_SETTINGS_DOCUMENT_PATH')
    expect(action).toContain('requestSettingsDocumentPath')
    expect(action).toContain('sdk.openFile(path)')
    expect(action).toContain('DshIconSetting as IconSetting')
    expect(action).toContain('<IconSetting />')
    expect(action).toContain('type="secondary"')
    expect(action).toContain('theme="outline"')
    expect(style).toContain('.dsh-fnos-settings-document-button')
    expect(style).toContain('margin-right: 6px')
    expect(index).toContain("id: 'open-document'")
    expect(index).toContain('priority: -1')
    expect(index).toContain('FnosSettingsDocumentAction')
    expect(contract).toContain("'/plugins/dsh-fnos/settings/document'")
  })

  it('replaces the fnOS Session log utility with a computer/NAS menu', async () => {
    const index = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')
    const action = await readFile(new URL('../../src/components/FnosSessionLogHeaderAction.tsx', import.meta.url), 'utf8')
    const host = await readFile(new URL('../../src/host/authorized-directories.ts', import.meta.url), 'utf8')
    const contract = await readFile(new URL('../../src/contracts/session-log-export-contract.ts', import.meta.url), 'utf8')
    const style = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    const theme = await readFile(new URL('../../../../packages/dsh-semi-ui/src/theme.scss', import.meta.url), 'utf8')
    const seats = await readFile(new URL('../../src/client/header-utility-seats.ts', import.meta.url), 'utf8')
    expect(seats).toContain("id: 'session-log-download'")
    expect(index).toMatch(/ctx\.slots\.register\(\{\s*\.\.\.FNOS_SESSION_LOG_SEAT,/u)
    expect(index).toContain('FnosSessionLogHeaderAction')
    expect(action).toContain('Menu')
    expect(action).toContain('IconEllipsisOutline16')
    // 触发按钮是纯图标：不带文案、不带边框。它打开「导出到电脑 / 导出到 NAS」
    // 两项菜单，`Ellipsis` 才表示「还有更多操作」。
    expect(action).not.toContain('DshIconDownload')
    expect(action).not.toContain('DshButton')
    expect(action).not.toContain('DshDropdown')
    expect(action).not.toContain('dsh-fnos-session-log-button-icon')
    // 菜单项自带图标，与官方 session-log-export 一致。
    expect(action).toContain('<IconDownloadOutline16 />')
    expect(action).toContain('<IconFolderOpenOutline16 />')
    expect(action).toContain('aria-haspopup="menu"')
    // 文案只出现在 aria-label 上（无障碍需要），不作为可见文字渲染。
    expect(action).toContain("aria-label={t('sessionLog')}")
    expect(action).not.toContain("{t('sessionLog')}</")
    // 28px 圆形纯图标按钮，数值取自官方 session-log-export 的 CSS module。
    expect(style).toMatch(/\.dsh-fnos-session-log-button \{[^}]*width: 28px;/u)
    expect(style).toMatch(/\.dsh-fnos-session-log-button \{[^}]*height: 28px;/u)
    expect(style).toMatch(/\.dsh-fnos-session-log-button \{[^}]*border: none;/u)
    expect(style).toMatch(/\.dsh-fnos-session-log-button \{[^}]*background: transparent;/u)
    expect(style).toMatch(/\.dsh-fnos-session-log-button svg \{[^}]*width: 15px;/u)
    expect(style).toContain('.dsh-fnos-session-log-button:hover')
    expect(action).toContain('nasExportEnabled')
    expect(theme).toContain('.semi-button.semi-button-solid:not(.semi-button-disabled)')
    expect(theme).toContain(':not([data-ds-dark-theme]) .semi-button.semi-button-solid:not(.semi-button-disabled)')
    expect(theme).toContain('body[data-dsh-semi-theme][data-ds-dark-theme] .semi-button.semi-button-solid:not(.semi-button-disabled)')
    expect(action).toContain('DshTree')
    expect(action).toContain('useSessionLogDownload')
    expect(action).toContain('sessionLogDialogPreparingTitle')
    expect(action).toContain('dismissDownload(sessionId)')
    expect(action).not.toContain('treeCheckable')
    // 上游取数走 DSH 自己的 /api/session.export。早前走 ctx.get('apiProxy')
    // 是死的：全仓与上游都没有该服务的提供方，取值恒为 undefined，每次
    // 「导出到 NAS」都必然 503。这里钉住不再回到那个写法——只匹配代码调用，
    // 避免被解释该 bug 的注释误伤。
    expect(host).toContain('/api/session.export')
    expect(host).not.toMatch(/=\s*ctx\.get\(['"]apiProxy['"]\)/u)
    expect(host).toContain("url.searchParams.set('includeDescendants', 'true')")
    expect(host).toContain('req.headers.cookie')
    expect(host).toContain('fetchSessionLogZip(ctx, request.sessionId, abortController.signal, req.headers.cookie)')
    expect(contract).toContain("'/plugins/dsh-fnos/session-log/export'")
  })

  it('keeps the original DSH workspace flow and augments it with a shortcut', async () => {
    const source = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')
    const shortcut = await readFile(new URL('../../src/client/shortcuts/workspace-authorized-shortcut.ts', import.meta.url), 'utf8')
    const picker = await readFile(new URL('../../src/components/FnosAuthorizedPathPicker.tsx', import.meta.url), 'utf8')
    const restart = await readFile(new URL('../../src/components/FnosWebRestartAction.tsx', import.meta.url), 'utf8')
    const clientStyle = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    expect(source).toContain('installWorkspaceAuthorizedShortcut')
    expect(source).not.toContain('directoryFlow')
    expect(shortcut).toContain('requestAuthorizedDirectories')
    expect(shortcut).toContain('DshDropdown as Dropdown')
    expect(shortcut).toContain('DshIconButton as IconButton')
    expect(shortcut).toContain('onClick: load')
    expect(shortcut).toContain('onClick: () => { fillAfterOpening')
    expect(shortcut).toContain('function submitPathInput')
    expect(shortcut).toContain('submitAfterInputUpdate(dialog)')
    expect(shortcut).toContain('onMouseDown: (event: MouseEvent) => { event.preventDefault() }')
    expect(shortcut).not.toContain('input.blur()')
    expect(shortcut).not.toContain('new KeyboardEvent')
    expect(shortcut).not.toContain('installSemiDshTheme')

    const client = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')
    expect(client).toContain("from '@tnnevol/dsh-semi-ui'")
    expect(client).toContain("installSemiDshTheme(), 'dsh-fnos: Semi DSH theme'")


    const themeRuntime = await readFile(new URL('../../../../packages/dsh-semi-ui/src/theme.ts', import.meta.url), 'utf8')
    const semiTheme = await readFile(new URL('../../../../packages/dsh-semi-ui/src/theme.scss', import.meta.url), 'utf8')
    expect(semiTheme).toContain('data-dsh-semi-theme')
    expect(themeRuntime).toContain("const SEMI_THEME_MODE_ATTRIBUTE = 'theme-mode'")
    expect(themeRuntime).toContain('data-ds-dark-theme')
    expect(themeRuntime).toContain("setAttribute(SEMI_THEME_MODE_ATTRIBUTE, document.body.hasAttribute(DSH_DARK_THEME_ATTRIBUTE) ? 'dark' : 'light')")
    expect(themeRuntime).toContain('MutationObserver')
    expect(semiTheme).toContain('--semi-color-bg-3: var(--dsw-alias-bg-layer-3)')
    expect(semiTheme).toContain('--semi-color-text-0: var(--dsw-alias-label-primary)')
    expect(semiTheme).toContain('.semi-dropdown-wrapper')
    expect(semiTheme).toContain('.semi-tooltip-wrapper')
    expect(semiTheme).toContain('background-color: var(--dsw-alias-tooltip-bg)')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-00)')
    expect(semiTheme).toContain('pointer-events: none')
    expect(clientStyle).toContain('.dsh-fnos-authorized-path-picker {')
    expect(clientStyle).toContain('.semi-tree-option-list {')
    expect(clientStyle).toContain('overflow-x: auto')
    expect(clientStyle).toContain('width: 100% !important')
    expect(semiTheme).toContain('semi-checkbox-unChecked:hover')
    expect(semiTheme).toContain('.semi-checkbox:not(.semi-checkbox-checked):not(.semi-checkbox-indeterminate):hover')
    expect(semiTheme).toContain('.semi-tree-option-disabled .semi-tree-option-label')
    expect(semiTheme).not.toContain('data-dsh-fnos-link')

    expect(semiTheme).not.toContain('data-dsh-fnos-input-references')
    expect(picker).toContain('borderless')
    expect(picker).toContain('multiple')
    expect(picker).toContain('checkRelation="unRelated"')
    expect(picker).not.toContain('treeCheckable')
    expect(picker).not.toContain('new KeyboardEvent')
    expect(semiTheme).toContain('.dsh-fnos-input-picker-trigger')
    expect(semiTheme).toContain('border: none;')
    expect(semiTheme).toContain('background: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain('border-color: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('background: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('border-color: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain(':not([data-ds-dark-theme]) .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled)')
    expect(semiTheme).toContain('background-color: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain('body[data-dsh-semi-theme][data-ds-dark-theme] .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled)')
    expect(semiTheme).toContain('.semi-button.dsh-fnos-web-refresh:not(.semi-button-borderless):not(.semi-button-disabled)')
    expect(semiTheme).not.toContain('height: 42px')
    expect(semiTheme).not.toContain('font-size: 14px')
    expect(restart).toContain('size="small"')
    expect(semiTheme).toContain('background: transparent;')
    expect(semiTheme).toContain('var(--dsw-alias-interactive-bg-hover);')
    expect(semiTheme).toContain('--semi-border-radius-full: 9999px;')
    expect(semiTheme).toContain('font-weight: 400;')
    expect(restart).toContain('className="dsh-fnos-web-actions"')
    expect(restart).toContain('dsh-fnos-web-actions--collapsed')
    expect(restart).toContain('theme="borderless"')
    expect(semiTheme).not.toContain('!important')
    expect(semiTheme).toContain('var(--dsw-shadow-lv3)')
    expect(semiTheme).toContain('.dsh-fnos-web-actions--collapsed')
    expect(semiTheme).toContain('justify-content: center;')
  })

  it('keeps fnOS file and folder references in the native input draft', async () => {
    const actions = await readFile(new URL('../../src/client/input-references/input-reference-actions.ts', import.meta.url), 'utf8')
    expect(actions).toContain("appearance: reference.kind === 'directory' ? 'folder' : 'file'")
    expect(actions).toContain('referenceLabel')
    expect(actions).toContain('restoreFnosInputCaret')
    expect(actions).toContain('fnosReferenceDraftText')
    expect(actions).toContain("return '\\uFFFC'")
    expect(actions).toContain("slash/input-insert-reference")
    expect(actions).toContain("appearance: reference.kind === 'directory' ? 'folder' : 'file'")
    expect(actions).not.toContain('\\u00a0')
    const picker = await readFile(new URL('../../src/components/FnosAuthorizedPathPicker.tsx', import.meta.url), 'utf8')
    expect(picker).toContain('const value = desiredPaths ?? EMPTY_TREE_VALUE')
    const pickerStyle = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    expect(pickerStyle).toContain('max-width: min(560px, calc(100vw - 32px))')
    expect(pickerStyle).toContain('overflow-x: auto')
    expect(picker).toContain('insertedTreePaths.current.clear()')
    expect(picker).toContain('return paths')
  })

  it('遮蔽官方「打开应用」入口并提供 fnOS 文件入口', async () => {
    const index = await readFile(new URL('../../src/client/index.ts', import.meta.url), 'utf8')
    const action = await readFile(new URL('../../src/components/FnosOpenInHeaderAction.tsx', import.meta.url), 'utf8')
    const locales = await readFile(new URL('../../src/client/locales.ts', import.meta.url), 'utf8')

    // 遮蔽靠同 id + 更低 priority：官方条目用默认 0，同优先级会直接抛错，
    // 那时整个插件都加载不起来。座位形状集中在 header-utility-seats.ts，
    // 其顺序由 tests/client/header-utility-order.spec.ts 用真实 SlotCore 验证。
    const seats = await readFile(new URL('../../src/client/header-utility-seats.ts', import.meta.url), 'utf8')
    expect(seats).toContain("id: 'open-in-app'")
    // 必须真的把座位展开进 register 调用：只断言 import 会在把参数改回硬编码
    // 时照样通过（顺序随之静默变回错误值）。
    expect(index).toMatch(/ctx\.slots\.register\(\{\s*\.\.\.FNOS_OPEN_IN_APP_SEAT,/u)
    expect(index).toMatch(/ctx\.slots\.register\(\{\s*\.\.\.FNOS_SESSION_LOG_SEAT,/u)
    // 只在 fnOS iframe 内注册，独立浏览器保持官方行为。
    expect(index).toContain('isEmbeddedFnosFrame()')
    expect(index).toContain('FnosOpenInHeaderAction')

    // 用的是 fnOS 原生的文件管理器，而不是对目录无意义的 openFile。
    expect(action).toContain('openFileManager')
    expect(action).toContain("label: t => t('fileManager')")
    expect(locales).toContain("fileManager: '文件管理'")
    expect(action).not.toContain('sdk.openFile(')

    // 分体按钮：左半执行当前操作、右半展开菜单，两半各自可点。这是官方
    // `OpenInAppAction` 的交互，样式数值也按它对齐（见下一条用例）。
    expect(action).toContain('dsh-fnos-open-in-split')
    expect(action).toContain('dsh-fnos-open-in-main')
    expect(action).toContain('dsh-fnos-open-in-chevron')
    expect(action).toContain('selection="fill"')
    expect(action).toContain('aria-haspopup="menu"')
    expect(action).toContain('aria-expanded={open}')
    expect(action).toContain('IconChevronDownOutline14')

    // 左半按钮用 fnOS 文件管理器的真实图标，由插件自己的静态路由提供。
    expect(action).toContain('FnosFileManagerIcon')
    // 官方按钮 15px、菜单行 18px，两者要区分对待。
    expect(action).toContain('current.icon(15)')
    expect(action).toContain('action.icon(18)')
  })

  it('图标以插件自有前缀的资源 URL 引用，不内联进 bundle', async () => {
    const icon = await readFile(new URL('../../src/components/FnosFileManagerIcon.tsx', import.meta.url), 'utf8')
    const host = await readFile(new URL('../../src/host/static-assets.ts', import.meta.url), 'utf8')
    const contract = await readFile(new URL('../../src/contracts/static-assets-contract.ts', import.meta.url), 'utf8')
    const index = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8')
    const gateway = await readFile(new URL('../../../../packages/fnos-gateway/src/client/bridge.ts', import.meta.url), 'utf8')

    // 客户端只引用 URL；内联 data URL 会随脚本走，且无法随包更新或被缓存。
    expect(icon).toContain('FNOS_STATIC_PREFIX')
    expect(icon).not.toContain('data:image')
    expect(contract).toContain("'/fnos-plugins/static/dsh-fnos'")

    // 插件在 DSH 侧注册同名路由，并显式列举允许读取的资源名——
    // 请求路径只用于查表，不拼进文件系统路径。
    expect(index).toContain('registerStaticAssetRoute')
    expect(host).toContain("kind: 'prefix'")
    expect(host).toContain('FNOS_STATIC_ASSETS')
    expect(host).toContain('isKnownAsset')

    // 网关必须把该前缀列为内置前缀，否则浏览器 bridge 不补应用前缀，
    // fnOS 宿主会用自己的 404 回应。
    expect(gateway).toMatch(/builtinPaths = \[[^\]]*"\/fnos-plugins\/static"/u)

    // 不读取 fnOS 宿主的静态目录。
    expect(host).not.toContain('/usr/trim/www')
  })

  it('分体按钮的样式数值与官方入口一致', async () => {
    const style = await readFile(new URL('../../src/styles/index.scss', import.meta.url), 'utf8')
    // 头部控件行高与胶囊圆角：官方是 28px / 14px，两半之间用 l4 发丝线分隔。
    expect(style).toContain('.dsh-fnos-open-in-split {')
    expect(style).toMatch(/\.dsh-fnos-open-in-split \{[^}]*height: 28px;/u)
    expect(style).toMatch(/\.dsh-fnos-open-in-split \{[^}]*border-radius: 14px;/u)
    expect(style).toMatch(/\.dsh-fnos-open-in-chevron \{[^}]*border-left: 0\.5px solid var\(--dsw-alias-border-l4\);/u)
    // 两半各自的 hover 反馈与失败态。
    expect(style).toContain('.dsh-fnos-open-in-main:hover:not(:disabled)')
    expect(style).toContain(".dsh-fnos-open-in-main[data-state='error']")
  })

  it('declares the DSH API version used by the client bridge', async () => {
    const compatibility = JSON.parse(await readFile(new URL('../../compatibility.json', import.meta.url), 'utf8')) as {
      dshPluginApi: { version: string, packages: string[] }
    }
    expect(compatibility.dshPluginApi.version).toBe('0.1.5-rc.2')
    expect(compatibility.dshPluginApi.packages).toEqual([
      '@deepseek-ai/dsh-api-remotes',
      '@deepseek-ai/dsh-session',
      '@deepseek-ai/dsh-session-log-export',
      '@deepseek-ai/dsh-client-ui-theme',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-input-trigger',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-renderer',
      '@deepseek-ai/dsh-client-ui-workspace',
      '@deepseek-ai/dsh-client-ui-settings-plugins',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-session',
      '@deepseek-ai/dsh-host-webserver',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/schemastery',
    ])
  })
})
