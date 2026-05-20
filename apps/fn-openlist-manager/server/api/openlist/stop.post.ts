import { getDataDir } from "../../utils/openlist";
import { existsSync, readFileSync, unlinkSync } from "node:fs";

export default defineEventHandler(() => {
  const bin = getOpenlistBin();
  const dataDir = getDataDir();
  const pidFile = `${dataDir}/openlist.pid`;

  if (!existsSync(pidFile)) {
    return { success: false, message: "openlist 未在运行" };
  }

  const pid = readFileSync(pidFile, "utf-8").trim();
  if (!pid) {
    unlinkSync(pidFile);
    return { success: false, message: "openlist 未在运行" };
  }

  try {
    process.kill(Number(pid));
  } catch { /* ignore */ }

  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }

  return { success: true, message: "openlist 已停止" };
});
