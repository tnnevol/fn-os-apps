import { defineConfig } from 'vitest/config'
import { bridgeSourcePlugin } from './build/bridge-plugin.ts'

export default defineConfig({
  plugins: [bridgeSourcePlugin()],
})
