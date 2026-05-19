import { getOpenlistBin, getDataDir, getConfigPath } from "../../utils/openlist";
import { readFileSync, existsSync, statSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default defineEventHandler(async () => {
  const bin = getOpenlistBin();
  const configPath = getConfigPath();

  let version = "unknown";
  try {
    const raw = await execAsync(`${bin} version`).then(r => r.stdout);
    const line = raw.split("\n").find(l => l.startsWith("Version:"));
    version = line ? line.split(":")[1].trim() : "unknown";
  } catch {
    // version command may fail if binary not present
  }

  let config: any = null;
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
  }

  const dataDir = getDataDir();
  const dbPath = `${dataDir}/data.db`;
  const dbExists = existsSync(dbPath);

  return {
    version,
    running: dbExists,
    config,
  };
});
