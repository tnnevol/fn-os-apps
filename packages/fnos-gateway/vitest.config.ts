import { defineConfig, mergeConfig } from 'vitest/config'
import { bridgeSourcePlugin } from './build/bridge-plugin.ts'
import baseConfig from '../../vitest.config.mts'

export default mergeConfig(baseConfig, defineConfig({ plugins: [bridgeSourcePlugin()] }))
