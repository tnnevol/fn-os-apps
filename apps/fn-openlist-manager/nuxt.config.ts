// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const _dir = dirname(fileURLToPath(import.meta.url));
const outputBase = resolve(_dir, "../fn-openlist/app/server");

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@element-plus/nuxt"],
  nitro: {
    output: {
      dir: outputBase,
      publicDir: `${outputBase}/public`,
      serverDir: `${outputBase}/server`,
    },
  },
  runtimeConfig: {
    appDest: process.env.TRIM_APPDEST ?? resolve(_dir, "../fn-openlist/app"),
  },
});
