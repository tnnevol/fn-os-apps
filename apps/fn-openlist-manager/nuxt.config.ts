// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const _dir = dirname(fileURLToPath(import.meta.url));
const outputBase = resolve(_dir, "../fn-openlist/app/server");

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: [
    "@element-plus/nuxt",
    "@unocss/nuxt",
    "@vueuse/nuxt",
  ],
  css: ["~/assets/css/element-dark.css"],
  app: {
    head: {
      link: [{ rel: "icon", type: "image/png", href: "/image.png" }],
    },
  },
  nitro: {
    output: {
      dir: outputBase,
      publicDir: `${outputBase}/public`,
      serverDir: `${outputBase}`,
    },
  },
});
