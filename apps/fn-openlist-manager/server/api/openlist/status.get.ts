import {
  getOpenlistBin,
  getDataDir,
  getConfigPath,
} from "../../utils/openlist";
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

function getPort(): number | null {
  try {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
      return cfg.scheme?.http_port ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

export default defineEventHandler(async () => {
  const bin = getOpenlistBin();

  let version = "unknown";
  try {
    const raw = await execAsync(`${bin} version`).then((r) => r.stdout);
    const line = raw.split("\n").find((l) => l.startsWith("Version:"));
    version = line?.split(":")[1]?.trim() ?? "unknown";
  } catch {
    // version command may fail if binary not present
  }

  const adminPort = Number(process.env.wizard_admin_port) || 3000;
  const wsPort = adminPort + 1;

  return {
    version,
    running: checkPidFile(),
    port: getPort(),
    wsPort,
  };
});
