import { getOpenlistBin, getDataDir } from "../../utils/openlist";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";

const execAsync = promisify(exec);

async function downloadWithProgress(
  url: string,
  dest: string,
  onProgress: (pct: number) => void,
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败: HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  let received = 0;

  const writer = createWriteStream(dest);
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("无法读取响应流");
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.length;
    if (contentLength > 0) {
      onProgress(Math.round((received / contentLength) * 100));
    }
    writer.write(value);
  }

  return new Promise<void>((resolve) => {
    writer.end(() => resolve());
  });
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const bin = getOpenlistBin();

  const arch =
    process.arch === "arm64"
      ? "arm64"
      : process.arch === "x64"
        ? "amd64"
        : "amd64";
  const isLinux = process.platform === "linux";
  const target = isLinux ? `linux-musl-${arch}` : `darwin-${arch}`;

  const proxy = body.mirror || "https://ghproxy.net/";

  // Resolve version
  let targetVersion = body.version?.replace(/^v/, "");
  if (!targetVersion) {
    const { stdout } = await execAsync(
      `curl -sL "https://github.com/OpenListTeam/OpenList/releases" | grep -oE 'tag/v[0-9]+\\.[0-9]+\\.[0-9]+' | sed 's/tag\\///' | head -1`,
    );
    targetVersion = stdout.trim().replace(/^v/, "");
  }

  const downloadUrl = `${proxy}https://github.com/OpenListTeam/OpenList/releases/download/v${targetVersion}/openlist-${target}.tar.gz`;
  const tmpDir = process.env.TRIM_PKGTMP || "/tmp";
  const tarPath = join(tmpDir, "openlist.tar.gz");

  setHeader(event, "Content-Type", "text/event-stream");
  setHeader(event, "Cache-Control", "no-cache");
  setHeader(event, "Connection", "keep-alive");

  const stream = new ReadableStream({
    async start(controller) {
      const push = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        // Download with progress
        await downloadWithProgress(downloadUrl, tarPath, (pct) => {
          push({ step: "download", percent: pct });
        });

        push({ step: "download", percent: 100 });

        // Verify
        const { stdout: fileType } = await execAsync(`file "${tarPath}"`);
        const { stdout: fileSize } = await execAsync(`stat -f%z "${tarPath}"`);
        if (!fileType.includes("gzip") || Number(fileSize) < 102400) {
          throw new Error("下载文件无效，可能下载到了错误页面");
        }

        push({ step: "extract", percent: 0 });

        // Extract
        await execAsync(`tar xzf "${tarPath}" -C "${tmpDir}" openlist`);
        push({ step: "extract", percent: 100 });

        // Replace binary
        // Kill running process via pid file
        const dataDir = getDataDir();
        mkdirSync(dataDir, { recursive: true });
        const pidPath = `${dataDir}/openlist.pid`;
        if (existsSync(pidPath)) {
          const pid = readFileSync(pidPath, "utf-8").trim();
          if (pid) {
            try {
              process.kill(Number(pid));
            } catch {
              /* ignore */
            }
          }
        }

        mkdirSync(dirname(bin), { recursive: true });
        await execAsync(
          `mv "${tmpDir}/openlist" "${bin}" && chmod +x "${bin}"`,
        );
        push({ step: "install", percent: 100 });

        // Cleanup
        await execAsync(`rm -f "${tarPath}"`);

        // Restart with spawn to get real pid
        const child = spawn(bin, ["server", "--data", dataDir], {
          cwd: dataDir,
          stdio: "ignore",
        });
        writeFileSync(pidPath, String(child.pid));

        // Get version
        const { stdout } = await execAsync(`${bin} version`);
        const verLine = stdout
          .split("\n")
          .find((l) => l.startsWith("Version:"));
        const newVersion = verLine
          ? (verLine.split(":")[1]?.trim() ?? "unknown")
          : "unknown";

        push({ event: "done", version: newVersion });
      } catch (error: any) {
        push({ event: "error", message: error.message });
      } finally {
        controller.close();
      }
    },
  });

  return stream;
});
