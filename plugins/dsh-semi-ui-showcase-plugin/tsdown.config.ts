import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { UserConfig } from 'tsdown'
import { dshSemiClientDeps } from '../../packages/dsh-semi-ui/tsdown-client-deps.ts'

const PLUGIN_ID = '@tnnevol/dsh-semi-ui-showcase'
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
      ...dshSemiClientDeps.deps,
      neverBundle: [
        'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
        '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-runtime/client',
        '@deepseek-ai/dsh-client-ui-slots',
      ],
    },
    alias: dshSemiClientDeps.alias,
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
