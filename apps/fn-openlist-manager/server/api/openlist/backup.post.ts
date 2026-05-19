import { getDataDir } from "../../utils/openlist";
import { existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join } from "node:path";

export default defineEventHandler(() => {
  const dataDir = getDataDir();
  const backupBase = join(dataDir, "..", "backups");

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const backupDir = join(backupBase, `backup_${timestamp}`);

  if (!existsSync(dataDir)) {
    throw createError({ statusCode: 400, message: "数据目录不存在，请先运行 OpenList" });
  }

  mkdirSync(backupDir, { recursive: true });
  cpSync(dataDir, join(backupDir, "data"), { recursive: true });

  return { success: true, path: backupDir };
});
