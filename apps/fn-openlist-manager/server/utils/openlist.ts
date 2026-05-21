import { resolve } from "node:path";

function getAppDest(): string {
  return resolve(
    process.cwd(),
    process.env.TRIM_APPDEST || "../fn-openlist/app",
  );
}

export function getOpenlistBin(): string {
  return resolve(getAppDest(), "bin/openlist");
}

export function getDataDir(): string {
  return resolve(getAppDest(), process.env.TRIM_PKGVAR || "bin");
}

export function getOpenlistDataDir(): string {
  return resolve(getDataDir(), "data");
}

export function getConfigPath(): string {
  return resolve(getOpenlistDataDir(), "config.json");
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
