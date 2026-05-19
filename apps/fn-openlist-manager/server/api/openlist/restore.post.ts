import { getDataDir } from "../../utils/openlist";
import { existsSync, readdirSync, rmSync, cpSync, statSync } from "node:fs";
import { join } from "node:path";

export default defineEventHandler(async (event) => {
  const { backupName } = await readBody(event);
  const dataDir = getDataDir();
  const backupBase = join(dataDir, "..", "backups");

  if (!backupName) {
    throw createError({ statusCode: 400, message: "请选择备份" });
  }

  const backupPath = join(backupBase, backupName, "data");
  if (!existsSync(backupPath)) {
    throw createError({ statusCode: 404, message: `备份不存在: ${backupName}` });
  }

  // Backup current data before restore
  const currentBackup = join(backupBase, `pre_restore_${Date.now()}`);
  if (existsSync(dataDir)) {
    cpSync(dataDir, currentBackup, { recursive: true });
  }

  // Restore
  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true });
  }
  cpSync(backupPath, dataDir, { recursive: true });

  return { success: true, previousBackup: currentBackup };
});
