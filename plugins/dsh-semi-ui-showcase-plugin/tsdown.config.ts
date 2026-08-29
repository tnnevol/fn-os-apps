import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { UserConfig } from 'tsdown'

const PLUGIN_ID = '@tnnevol/dsh-semi-ui-showcase'
const require = createRequire(import.meta.url)
const semiUiRoot = join(require.resolve('@douyinfe/semi-ui'), '..', '..', '..')
const semiIconsRoot = join(require.resolve('@douyinfe/semi-icons'), '..', '..', '..')

async function inlineClientStyles(config: { cwd: string }): Promise<void> {
  const clientPath = join(config.cwd, 'lib', 'client.js')
  const stylePath = join(config.cwd, 'lib', 'style.css')
  try {
    const [client, styles] = await Promise.all([readFile(clientPath, 'utf8'), readFile(stylePath, 'utf8')])
    const statement = "import './style.css';\n"
    if (!client.startsWith(statement)) return
    const loader = `(() => { if (typeof document === 'undefined') return; const style = document.createElement('style'); style.dataset.dshSemiShowcase = ''; style.textContent = ${JSON.stringify(styles)}; document.head.append(style); })();\n`
    await writeFile(clientPath, client.replace(statement, loader), 'utf8')
  } catch {}
}

export default [
  {
    entry: 'src/index.ts',
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    deps: {
      alwaysBundle: [/^@tnnevol\/dsh-semi-ui(?:\/|$)/u, /^@douyinfe\/semi-ui(?:\/|$)/u, /^@douyinfe\/semi-icons(?:\/|$)/u],
      neverBundle: [
        'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
        '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-runtime/client',
        '@deepseek-ai/dsh-client-ui-slots',
      ],
    },
    alias: {
      '@douyinfe/semi-ui/lib/es/button/index.js': join(semiUiRoot, 'lib/es/button/index.js'),
      '@douyinfe/semi-ui/lib/es/modal/index': join(semiUiRoot, 'lib/es/modal/index.js'),
      '@douyinfe/semi-ui/lib/es/tree/index': join(semiUiRoot, 'lib/es/tree/index.js'),
      '@douyinfe/semi-ui/lib/es/cascader/index': join(semiUiRoot, 'lib/es/cascader/index.js'),
      '@douyinfe/semi-ui/lib/es/dropdown/index.js': join(semiUiRoot, 'lib/es/dropdown/index.js'),
      '@douyinfe/semi-ui/lib/es/iconButton/index.js': join(semiUiRoot, 'lib/es/iconButton/index.js'),
      '@douyinfe/semi-ui/lib/es/tooltip/index': join(semiUiRoot, 'lib/es/tooltip/index.js'),
      '@douyinfe/semi-ui/lib/es/treeSelect/index': join(semiUiRoot, 'lib/es/treeSelect/index.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconHistory.js': join(semiIconsRoot, 'lib/es/icons/IconHistory.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconClose.js': join(semiIconsRoot, 'lib/es/icons/IconClose.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconChevronDown.js': join(semiIconsRoot, 'lib/es/icons/IconChevronDown.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconFile.js': join(semiIconsRoot, 'lib/es/icons/IconFile.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconFolder.js': join(semiIconsRoot, 'lib/es/icons/IconFolder.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconFolderOpen.js': join(semiIconsRoot, 'lib/es/icons/IconFolderOpen.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconSetting.js': join(semiIconsRoot, 'lib/es/icons/IconSetting.js'),
    },
    css: { inject: true, minify: true },
    onSuccess: inlineClientStyles,
    define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
