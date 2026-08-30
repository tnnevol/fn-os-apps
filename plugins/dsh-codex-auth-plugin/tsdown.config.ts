import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { UserConfig } from 'tsdown'

// DSH's client module graph is keyed by the npm package name. The handoff ID
// must therefore match package.json exactly, including the scope.
const PLUGIN_ID = '@tnnevol/dsh-codex-auth'
const PACKAGE_VERSION = (JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }).version
const require = createRequire(import.meta.url)
const semiUiRoot = join(require.resolve('@douyinfe/semi-ui'), '..', '..', '..')
const semiIconsRoot = join(require.resolve('@douyinfe/semi-icons'), '..', '..', '..')

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

async function inlineClientStyles(config: { cwd: string }): Promise<void> {
  const clientPath = join(config.cwd, 'lib', 'client.js')
  const stylePath = join(config.cwd, 'lib', 'style.css')
  let client = ''
  let styles = ''
  try {
    client = await readFile(clientPath, 'utf8')
    styles = await readFile(stylePath, 'utf8')
  } catch {
    return
  }
  const importStatement = "import './style.css';\n"
  if (!client.startsWith(importStatement)) return
  const styleLoader = `(() => { if (typeof document === 'undefined') return; const style = document.createElement('style'); style.dataset.dshCodex = 'semi'; style.textContent = ${JSON.stringify(styles)}; document.head.append(style); })();\n`
  await writeFile(clientPath, client.replace(importStatement, styleLoader), 'utf8')
}

export default [
  {
    entry: {
      index: 'src/index.ts',
      auth: 'src/auth.ts',
      'auth-paths': 'src/auth-paths.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    define: {
      __DSH_CODEX_AUTH_VERSION__: JSON.stringify(PACKAGE_VERSION),
    },
    deps: {
      neverBundle: [
        '@earendil-works/pi-ai',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-atomic-write',
        '@deepseek-ai/dsh-home-paths',
        '@deepseek-ai/dsh-host-webserver',
      ],
    },
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
      neverBundle: [...CLIENT_EXTERNALS],
    },
    alias: {
      '@douyinfe/semi-ui/lib/es/button/index.js': join(semiUiRoot, 'lib/es/button/index.js'),
      '@douyinfe/semi-ui/lib/es/button/buttonGroup.js': join(semiUiRoot, 'lib/es/button/buttonGroup.js'),
      '@douyinfe/semi-ui/lib/es/cascader/index': join(semiUiRoot, 'lib/es/cascader/index.js'),
      '@douyinfe/semi-ui/lib/es/dropdown/index.js': join(semiUiRoot, 'lib/es/dropdown/index.js'),
      '@douyinfe/semi-ui/lib/es/iconButton/index.js': join(semiUiRoot, 'lib/es/iconButton/index.js'),
      '@douyinfe/semi-ui/lib/es/tooltip/index': join(semiUiRoot, 'lib/es/tooltip/index.js'),
      '@douyinfe/semi-ui/lib/es/treeSelect/index': join(semiUiRoot, 'lib/es/treeSelect/index.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconClose.js': join(semiIconsRoot, 'lib/es/icons/IconClose.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconFile.js': join(semiIconsRoot, 'lib/es/icons/IconFile.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconFolder.js': join(semiIconsRoot, 'lib/es/icons/IconFolder.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconFolderOpen.js': join(semiIconsRoot, 'lib/es/icons/IconFolderOpen.js'),
      '@douyinfe/semi-icons/lib/es/icons/IconRestart.js': join(semiIconsRoot, 'lib/es/icons/IconRestart.js'),
    },
    css: { inject: true, minify: true },
    onSuccess: inlineClientStyles,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      __DSH_CODEX_AUTH_VERSION__: JSON.stringify(PACKAGE_VERSION),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
