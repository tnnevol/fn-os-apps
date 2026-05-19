import { join } from "node:path";

export function getOpenlistBin(): string {
  const config = useRuntimeConfig();
  return join(config.appDest as string, "bin/openlist");
}

export function getDataDir(): string {
  const config = useRuntimeConfig();
  return join(config.appDest as string, "data");
}

export function getConfigPath(): string {
  const config = useRuntimeConfig();
  return join(config.appDest as string, "temp", "config.json");
}

export function runOpenlist(...args: string[]): Promise<string> {
  const { execFile } = require("node:child_process");
  const bin = getOpenlistBin();
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 30000 }, (error: Error | null, stdout: string) => {
      if (error) return reject(error);
      resolve(stdout.trim());
    });
  });
}
