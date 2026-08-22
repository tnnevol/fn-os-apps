import type { UserConfig } from 'tsdown'

export default {
  entry: 'src/index.ts',
  outDir: 'lib',
  format: ['esm'],
  platform: 'browser',
  target: 'es2020',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    neverBundle: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  },
} satisfies UserConfig
