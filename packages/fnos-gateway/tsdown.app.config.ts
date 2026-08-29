import type { UserConfig } from 'tsdown'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { bridgeSourcePlugin } from './build/bridge-plugin.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  entry: {
    'gateway-proxy': 'src/cli.ts',
  },
  outDir: resolve(__dirname, '../../apps/fn-deepseek-harness/app'),
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  fixedExtension: false,
  dts: false,
  clean: false,
  plugins: [bridgeSourcePlugin()],
  noExternal: ['connect', 'http-proxy-middleware'],
  outExtension: () => ({ js: '.mjs' }),
} satisfies UserConfig
