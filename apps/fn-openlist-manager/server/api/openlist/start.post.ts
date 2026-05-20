import { getOpenlistBin, getDataDir } from "../../utils/openlist";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";

export default defineEventHandler(() => {
  const bin = getOpenlistBin();
  const dataDir = getDataDir();
  const pidFile = `${dataDir}/openlist.pid`;

  // Check if already running
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, "utf-8").trim();
    if (pid) {
      try {
        process.kill(Number(pid), 0);
        return { success: false, message: "openlist 已在运行中" };
      } catch { /* stale pid, clean up */ }
    }
  }

  const child = spawn(bin, ["server", "--data", dataDir], {
    cwd: dataDir,
    stdio: "ignore",
  });

  writeFileSync(pidFile, String(child.pid));

  return { success: true, pid: child.pid, message: "openlist 已启动" };
});
