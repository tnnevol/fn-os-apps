import { defineConfig } from 'vitest/config'

/** Shared defaults for package and plugin unit tests. */
export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
  server: {
    deps: {
      inline: ['@douyinfe/semi-ui', '@douyinfe/semi-icons', '@douyinfe/semi-icons-lab'],
    },
  },
  ssr: {
    noExternal: ['@douyinfe/semi-ui', '@douyinfe/semi-icons', '@douyinfe/semi-icons-lab'],
  },
})
