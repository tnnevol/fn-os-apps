import type { UserConfig } from 'tsdown'
import { bridgeSourcePlugin } from './build/bridge-plugin.ts'

export default {
  entry: 'src/index.ts',
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  fixedExtension: false,
  dts: true,
  clean: true,
  plugins: [bridgeSourcePlugin()],
  noExternal: ['connect', 'http-proxy-middleware'],
} satisfies UserConfig
