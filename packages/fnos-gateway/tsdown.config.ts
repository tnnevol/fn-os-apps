import type { UserConfig } from 'tsdown'

export default {
  entry: 'src/index.ts',
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  fixedExtension: false,
  dts: true,
  clean: true,
  noExternal: ['connect', 'http-proxy-middleware'],
} satisfies UserConfig
