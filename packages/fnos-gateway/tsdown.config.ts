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
  // bridge:build creates lib/client/bridge.js before this config runs. Keep
  // that browser artifact available for bridgeSourcePlugin and app builds.
  clean: false,
  plugins: [bridgeSourcePlugin()],
  noExternal: ['connect', 'http-proxy-middleware'],
} satisfies UserConfig
