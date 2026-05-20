import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineNitroPlugin } from "nitropack/runtime";
import { getOpenlistBin, getDataDir } from "../utils/openlist";

function checkProcess(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export default defineNitroPlugin(async (_nitroApp) => {
  const bin = getOpenlistBin();
  const dataDir = getDataDir();
  const pidPath = join(dataDir, "openlist.pid");

  if (!existsSync(bin)) {
    console.log("[openlist] binary not found at:", bin);
    return;
  }

  if (existsSync(pidPath)) {
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim());
    if (checkProcess(pid)) {
      console.log("[openlist] already running with pid:", pid);
      return;
    }
  }

  mkdirSync(dataDir, { recursive: true });

  console.log("[openlist] starting openlist server...");
  const child = spawn(bin, ["server", "--data", dataDir], {
    cwd: dataDir,
    stdio: "ignore",
  });

  console.log("[openlist] started with pid:", child.pid);
  writeFileSync(pidPath, String(child.pid));
});
