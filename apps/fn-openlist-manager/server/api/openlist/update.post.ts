import { getOpenlistBin } from "../../utils/openlist";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const execAsync = promisify(exec);

export default defineEventHandler(async (event) => {
  const { mirror } = await readBody(event);
  const bin = getOpenlistBin();

  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : "amd64";
  const isLinux = process.platform === "linux";
  const target = isLinux ? `linux-musl-${arch}` : `darwin-${arch}`;

  const proxy = mirror || "https://ghproxy.net/";
  const latestUrl = `${proxy}https://github.com/OpenListTeam/OpenList/releases/latest/download/openlist-${target}.tar.gz`;

  const tmpDir = "/tmp";
  const tarPath = join(tmpDir, "openlist.tar.gz");

  try {
    // Download
    await execAsync(`curl -sL "${latestUrl}" -o "${tarPath}"`);

    // Extract
    await execAsync(`tar xzf "${tarPath}" -C "${tmpDir}" openlist`);

    // Replace binary
    await execAsync(`mv "${tmpDir}/openlist" "${bin}" && chmod +x "${bin}"`);

    // Cleanup
    await execAsync(`rm -f "${tarPath}"`);

    // Get new version
    const { stdout } = await execAsync(`${bin} version`);

    return { success: true, version: stdout.trim() };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `更新失败: ${error.message}`,
    });
  }
});
