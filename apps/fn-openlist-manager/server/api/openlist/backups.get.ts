import { getDataDir } from "../../utils/openlist";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export default defineEventHandler(() => {
  const dataDir = getDataDir();
  const backupBase = join(dataDir, "..", "backups");

  if (!existsSync(backupBase)) {
    return [];
  }

  const entries = readdirSync(backupBase);
  const backups = entries
    .filter(e => e.startsWith("backup_"))
    .map(name => {
      const dir = join(backupBase, name);
      const stats = statSync(dir);
      return { name, date: stats.mtime.toISOString(), size: "" };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return backups;
});
