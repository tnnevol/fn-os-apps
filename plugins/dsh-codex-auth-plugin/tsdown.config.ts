import { readFileSync } from 'node:fs'
import type { UserConfig } from 'tsdown'

// DSH's client module graph is keyed by the npm package name. The handoff ID
// must therefore match package.json exactly, including the scope.
const PLUGIN_ID = '@tnnevol/dsh-codex-auth'
const PACKAGE_VERSION = (JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }).version

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

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
    deps: { neverBundle: [...CLIENT_EXTERNALS] },
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
