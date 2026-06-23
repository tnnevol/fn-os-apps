import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import VueDevTools from "vite-plugin-vue-devtools";
import UnoCSS from "@unocss/vite";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  base: "",
  plugins: [
    vue(),
    VueDevTools({
      launchEditor: "qoder",
    }),
    UnoCSS(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL("../www", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5245,
  },
});
