import { getDataDir } from "../../utils/openlist";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";

const execAsync = promisify(exec);

export default defineEventHandler(async (event) => {
  const dataDir = getDataDir();

  if (!existsSync(dataDir)) {
    throw createError({ statusCode: 400, message: "数据目录不存在，请先运行 OpenList" });
  }

  const tmpDir = process.env.TRIM_PKGTMP || "/tmp";
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const zipPath = join(tmpDir, `openlist-backup-${timestamp}.zip`);

  await execAsync(`cd "${dataDir}/.." && zip -r "${zipPath}" data`);

  const stats = await import("node:fs").then(fs => fs.promises.stat(zipPath));

  setHeader(event, "Content-Type", "application/zip");
  setHeader(event, "Content-Disposition", `attachment; filename="openlist-backup-${timestamp}.zip"`);
  setHeader(event, "Content-Length", stats.size);

  return sendStream(event, createReadStream(zipPath));
});
