import { getOpenlistBin } from "../../utils/openlist";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const execAsync = promisify(exec);

function getPkgvarDir(): string {
  return process.env.TRIM_PKGVAR || "";
}

function checkPidFile(): boolean {
  const pkgvarDir = getPkgvarDir();
  if (!pkgvarDir) return false;

  const pidFile = join(pkgvarDir, "app.pid");

  if (!existsSync(pidFile)) {
    return false;
  }

  try {
    const content = readFileSync(pidFile, "utf-8").trim();
    const pid = content.split("\n")[0]?.trim();
    if (!pid) return false;

    process.kill(Number(pid), 0);
    return true;
  } catch {
    try {
      unlinkSync(pidFile);
    } catch {
      // ignore
    }
    return false;
  }
}

async function checkProcessRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("ps aux");
    return stdout.includes("openlist server") || stdout.includes("openlist start");
  } catch {
    return false;
  }
}

export default defineEventHandler(async () => {
  const bin = getOpenlistBin();

  let version = "unknown";
  try {
    const raw = await execAsync(`${bin} version`).then(r => r.stdout);
    const line = raw.split("\n").find(l => l.startsWith("Version:"));
    version = line?.split(":")[1]?.trim() ?? "unknown";
  } catch {
    // version command may fail if binary not present
  }

  // Production: PID file check. Dev fallback: process name check.
  let running = checkPidFile();
  if (!running) {
    running = await checkProcessRunning();
  }

  return {
    version,
    running,
  };
});
