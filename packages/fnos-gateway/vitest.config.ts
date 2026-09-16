import { defineConfig, mergeConfig } from 'vitest/config'
import { bridgeSourcePlugin } from './plugins/bridge-plugin.ts'
import baseConfig from '../../vitest.config.mts'

export default mergeConfig(baseConfig, defineConfig({ plugins: [bridgeSourcePlugin()] }))
