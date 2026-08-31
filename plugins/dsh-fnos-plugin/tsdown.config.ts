import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { UserConfig } from 'tsdown'
import { dshSemiClientDeps } from '../../packages/dsh-semi-ui/tsdown-client-deps.ts'

const PLUGIN_ID = '@tnnevol/dsh-fnos'
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
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
    // The node build runs before the client build and has no client CSS yet.
    return
  }
  const importStatement = "import './style.css';\n"
  if (!client.startsWith(importStatement)) return
  const styleLoader = `(() => { if (typeof document === 'undefined') return; const style = document.createElement('style'); style.dataset.dshFnos = 'semi'; style.textContent = ${JSON.stringify(styles)}; document.head.append(style); })();\n`
  await writeFile(clientPath, client.replace(importStatement, styleLoader), 'utf8')
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
    deps: {
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-host-webserver',
        '@deepseek-ai/dsh-settings',
        '@deepseek-ai/schemastery',
      ],
    },
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    sourcemap: false,
    deps: {
      ...dshSemiClientDeps.deps,
      neverBundle: [...CLIENT_EXTERNALS],
    },
    alias: dshSemiClientDeps.alias,
    css: { inject: true, minify: true },
    onSuccess: inlineClientStyles,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
