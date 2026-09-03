import type { UserConfig } from 'tsdown'

/** Build the browser bridge before the Node gateway embeds it into its bundle. */
export default {
  entry: {
    'client/bridge': 'src/client/bridge.ts',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'browser',
  target: 'es2020',
  fixedExtension: false,
  dts: false,
  clean: false,
  sourcemap: false,
} satisfies UserConfig
