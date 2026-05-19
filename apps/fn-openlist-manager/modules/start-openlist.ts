import { defineNuxtModule, createResolver } from "@nuxt/kit";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

export default defineNuxtModule({
  meta: {
    name: "start-openlist",
  },
  async setup(_options, nuxt) {
    if (!nuxt.options.dev) return;

    const { resolve } = createResolver(nuxt.options.rootDir);

    function getAppDest(): string {
      if (process.env.TRIM_APPDEST) return process.env.TRIM_APPDEST;
      return resolve("../fn-openlist/app");
    }

    function getOpenlistBin(): string {
      return resolve(getAppDest(), "bin/openlist");
    }

    function getDataDir(): string {
      if (process.env.TRIM_PKGVAR) {
        return resolve(process.env.TRIM_PKGVAR, "data");
      }
      return resolve(getAppDest(), "bin/data");
    }

    nuxt.hook("ready", async () => {
      const bin = getOpenlistBin();
      const dataDir = getDataDir();

      if (!existsSync(bin)) {
        console.log("[openlist] binary not found at:", bin);
        return;
      }

      mkdirSync(dataDir, { recursive: true });

      console.log("[openlist] starting openlist server...");
      const child = spawn(bin, ["server", "--data", dataDir], {
        cwd: bin,
        detached: true,
        stdio: "ignore",
      });

      child.unref();
      console.log("[openlist] started with pid:", child.pid);
    });
  },
});
