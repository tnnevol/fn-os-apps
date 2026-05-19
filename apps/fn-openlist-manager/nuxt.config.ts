// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const _dir = dirname(fileURLToPath(import.meta.url))
const outputBase = resolve(_dir, '../fn-openlist/app/server/.output')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    output: {
      dir: outputBase,
      publicDir: `${outputBase}/public`,
      serverDir: `${outputBase}/server`,
    },
  },
})
