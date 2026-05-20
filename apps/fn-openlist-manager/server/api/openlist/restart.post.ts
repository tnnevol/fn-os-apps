import { getOpenlistBin, getDataDir } from "../../utils/openlist";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";

export default defineEventHandler(() => {
  const bin = getOpenlistBin();
  const dataDir = getDataDir();
  const pidFile = `${dataDir}/openlist.pid`;

  // Stop existing
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, "utf-8").trim();
    if (pid) {
      try {
        process.kill(Number(pid));
      } catch { /* ignore */ }
    }
    unlinkSync(pidFile);
  }

  // Start
  const child = spawn(bin, ["server", "--data", dataDir], {
    cwd: dataDir,
    stdio: "ignore",
  });

  writeFileSync(pidFile, String(child.pid));

  return { success: true, pid: child.pid, message: "openlist 已重启" };
});
