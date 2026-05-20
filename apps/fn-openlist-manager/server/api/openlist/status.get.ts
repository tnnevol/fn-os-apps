import { getOpenlistBin, getDataDir } from "../../utils/openlist";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function checkPidFile(): boolean {
  try {
    const dataDir = getDataDir();
    const pidFile = `${dataDir}/openlist.pid`;

    if (!existsSync(pidFile)) return false;

    const pid = readFileSync(pidFile, "utf-8").trim();
    if (!pid) return false;

    process.kill(Number(pid), 0);
    return true;
  } catch {
    try {
      unlinkSync(`${getDataDir()}/openlist.pid`);
    } catch {
      // ignore
    }
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

  return {
    version,
    running: checkPidFile(),
  };
});
