import { resolve } from "node:path";

function getAppDest(): string {
  if (process.env.TRIM_APPDEST) return process.env.TRIM_APPDEST;
  return resolve(process.cwd(), "../fn-openlist/app");
}

export function getOpenlistBin(): string {
  return resolve(getAppDest(), "bin/openlist");
}

export function getDataDir(): string {
  if (process.env.TRIM_PKGVAR) {
    return resolve(process.env.TRIM_PKGVAR, "data");
  }
  return resolve(getAppDest(), "bin/data");
}

export function getConfigPath(): string {
  return resolve(getDataDir(), "config.json");
}

export function runOpenlist(...args: string[]): Promise<string> {
  const { execFile } = require("node:child_process");
  const bin = getOpenlistBin();
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: 30000 },
      (error: Error | null, stdout: string) => {
        if (error) return reject(error);
        resolve(stdout.trim());
      },
    );
  });
}
