import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { UserConfig } from 'tsdown'
import { dshSemiClientDeps } from '../../packages/dsh-semi-ui/tsdown-client-deps.ts'

// DSH's client module graph is keyed by the npm package name. The handoff ID
// must therefore match package.json exactly, including the scope.
const PLUGIN_ID = '@tnnevol/dsh-codebuddy'
const PACKAGE_VERSION = (JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }).version
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

// @tnnevol/dsh-semi-ui 是 workspace 链接包：若 rolldown 按其 exports 解析出绝对
// 路径后 externalize，client 会残留 require("@tnnevol/dsh-semi-ui")（DSH 模块表
// 无此包）。显式 alias 到真实入口，强制与 @douyinfe 子路径一样内联。
import { fileURLToPath } from 'node:url'
const semiUiEntry = fileURLToPath(new URL('../../packages/dsh-semi-ui/lib/index.js', import.meta.url))

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
  const styleLoader = `(() => { if (typeof document === 'undefined') return; const style = document.createElement('style'); style.dataset.dshCodebuddy = 'semi'; style.textContent = ${JSON.stringify(styles)}; document.head.append(style); })();\n`
  await writeFile(clientPath, client.replace(importStatement, styleLoader), 'utf8')
}

export default [
  {
    entry: {
      index: 'src/index.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    define: {
      __DSH_CODEBUDDY_VERSION__: JSON.stringify(PACKAGE_VERSION),
    },
    deps: {
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-home-paths',
        '@deepseek-ai/dsh-llm',
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
      ...dshSemiClientDeps.deps,
      // echarts 是本插件独有的依赖（Token 统计图表），DSH 浏览器模块表没有
      // 它，必须内联进 bundle；否则运行时 require 直接报 module table miss。
      alwaysBundle: [
        // 本插件独有依赖（Token 图表），DSH 模块表没有 → 内联
        /^echarts(?:\/|$)/u, /^zrender(?:\/|$)/u,
        // semi-ui 内部运行时依赖（Popover/TimePicker 等），浏览器端同样没有
        /^date-fns(?:\/|$)/u,
      ],
      neverBundle: [...CLIENT_EXTERNALS],
    },
    alias: {
      ...dshSemiClientDeps.alias,
      '@tnnevol/dsh-semi-ui': semiUiEntry,
    },
    css: { inject: true, minify: true },
    onSuccess: inlineClientStyles,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      __DSH_CODEBUDDY_VERSION__: JSON.stringify(PACKAGE_VERSION),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
