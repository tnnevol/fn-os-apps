import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { defineNitroPlugin } from "nitropack/runtime";
import {
  getOpenlistDataDir,
  getOpenlistBin,
  getDataDir,
} from "../utils/openlist";

const execAsync = promisify(exec);

// 处理日志连接
function handleLogConnection(ws: WebSocket) {
  const openlistDataDir = getOpenlistDataDir();
  const logFile = join(openlistDataDir, "log", "log.log");

  // 如果日志文件不存在,发送空数据并关闭连接
  if (!existsSync(logFile)) {
    ws.send(JSON.stringify({ lines: [] }));
    ws.close();
    return;
  }

  // 先发送最后 200 行
  let buffer = "";
  const head = spawn("tail", ["-n", "200", logFile]);
  head.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
  });

  head.on("close", () => {
    if (ws.readyState === WebSocket.OPEN) {
      const lines = buffer.split("\n").filter(Boolean);
      ws.send(JSON.stringify({ lines }));
    }
  });

  // 然后通过 tail -f 跟踪新行
  let lineBuffer = "";
  const tail = spawn("tail", ["-f", logFile]);

  const sendLine = (line: string) => {
    if (line.trim() && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ line }));
    }
  };

  tail.stdout.on("data", (chunk: Buffer) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() || "";
    lines.forEach(sendLine);
  });

  // 连接关闭时清理
  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    tail.kill();
    head.kill();
  });

  ws.on("error", (error) => {
    console.error("[WS] Error:", error);
    tail.kill();
    head.kill();
  });
}

// 使用 curl 下载文件（自带进度、超时、取消支持）
function downloadWithCurl(
  url: string,
  dest: string,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // --progress-bar: 输出进度百分比
    // -L: 跟随重定向
    // --max-time: 总超时 5 分钟
    // --connect-timeout: 连接超时 30s
    const args = [
      "-L",
      url,
      "-o",
      dest,
      "--progress-bar",
      "--max-time",
      "300",
      "--connect-timeout",
      "30",
    ];
    const curl = spawn("curl", args);

    // 监听取消信号
    const onAbort = () => {
      curl.kill();
      reject(new Error("下载已取消"));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    // curl 的 stderr 输出进度信息，格式如：
    //   45 1000M   45  450M    0:00:10  0:00:04 --:--:--  50.0M
    //  百分比   总大小  已下载  总时间    已用时间   速度
    let lastPercent = -1;
    curl.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      // 匹配进度百分比（行首的数字）
      const match = text.match(/^\s*(\d{1,3})/);
      if (match) {
        const pct = parseInt(match[1]!, 10);
        if (!isNaN(pct) && pct !== lastPercent && pct <= 100) {
          lastPercent = pct;
          onProgress(pct);
        }
      }
    });

    curl.on("close", (code) => {
      signal.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolve();
      } else if (!signal.aborted) {
        reject(new Error(`curl 下载失败，退出码: ${code}`));
      }
    });

    curl.on("error", (err) => {
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
  });
}

// 处理更新连接
async function handleUpdateConnection(ws: WebSocket, url: URL) {
  console.log("[WS] Update connection received");

  // 解析 URL 参数
  const mirror = url.searchParams.get("mirror") || "https://ghproxy.net/";
  const version = url.searchParams.get("version")?.replace(/^v/, "") || "";

  // 用于取消下载的 AbortController
  const abortController = new AbortController();
  let clientConnected = true;

  const send = (data: any) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  };

  // 监听客户端断开，取消下载
  ws.on("close", () => {
    console.log("[WS] Update client disconnected");
    clientConnected = false;
    abortController.abort();
  });

  ws.on("error", () => {
    clientConnected = false;
    abortController.abort();
  });

  // 超时保护（10分钟）
  const timeout = setTimeout(
    () => {
      if (clientConnected) {
        console.log("[WS] Update timeout");
        send({ event: "error", message: "更新超时（10分钟）" });
        abortController.abort();
        ws.close();
      }
    },
    10 * 60 * 1000,
  );

  try {
    const bin = getOpenlistBin();
    const arch =
      process.arch === "arm64"
        ? "arm64"
        : process.arch === "x64"
          ? "amd64"
          : "amd64";
    const isLinux = process.platform === "linux";
    const target = isLinux ? `linux-musl-${arch}` : `darwin-${arch}`;

    // 解析版本
    let targetVersion = version;
    if (!targetVersion || targetVersion === "latest") {
      const { stdout } = await execAsync(
        `curl -sL --max-time 30 "https://github.com/OpenListTeam/OpenList/releases" | grep -oE 'tag/v[0-9]+\\.[0-9]+\\.[0-9]+' | sed 's/tag\\///' | head -1`,
        { timeout: 35000 },
      );
      targetVersion = stdout.trim().replace(/^v/, "");
    }

    if (!targetVersion) {
      throw new Error("无法解析目标版本");
    }

    const downloadUrl = `${mirror}https://github.com/OpenListTeam/OpenList/releases/download/v${targetVersion}/openlist-${target}.tar.gz`;
    const tmpDir = process.env.TRIM_PKGTMP || "/tmp";
    const tarPath = join(tmpDir, "openlist.tar.gz");

    // 下载（使用 curl，自带进度和超时控制）
    await downloadWithCurl(
      downloadUrl,
      tarPath,
      (pct) => send({ step: "download", percent: pct }),
      abortController.signal,
    );

    send({ step: "download", percent: 100 });

    // 验证
    const { stdout: fileType } = await execAsync(`file "${tarPath}"`, {
      timeout: 10000,
    });
    const statFlag = process.env.TRIM_APPNAME ? "-c%s" : "-f%z";
    const { stdout: fileSize } = await execAsync(
      `stat ${statFlag} "${tarPath}"`,
      { timeout: 10000 },
    );
    if (!fileType.includes("gzip") || Number(fileSize) < 102400) {
      throw new Error("下载文件无效，可能下载到了错误页面");
    }

    send({ step: "extract", percent: 0 });

    // 解压
    await execAsync(`tar xzf "${tarPath}" -C "${tmpDir}" openlist`, {
      timeout: 60000,
    });
    send({ step: "extract", percent: 100 });

    // 替换二进制
    const dataDir = getDataDir();
    const openlistDataDir = getOpenlistDataDir();
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
    await execAsync(`mv "${tmpDir}/openlist" "${bin}" && chmod +x "${bin}"`, {
      timeout: 30000,
    });
    send({ step: "install", percent: 100 });

    // 清理
    await execAsync(`rm -f "${tarPath}"`, { timeout: 10000 });

    // 重启
    const child = spawn(bin, ["server", "--data", openlistDataDir], {
      cwd: openlistDataDir,
      stdio: "ignore",
    });
    writeFileSync(pidPath, String(child.pid));

    // 获取版本
    const { stdout } = await execAsync(`${bin} version`, { timeout: 10000 });
    const verLine = stdout.split("\n").find((l) => l.startsWith("Version:"));
    const newVersion = verLine
      ? (verLine.split(":")[1]?.trim() ?? "unknown")
      : "unknown";

    send({ event: "done", version: newVersion });
  } catch (error: any) {
    // 忽略客户端断开或主动取消导致的错误
    const isAbort =
      error.name === "AbortError" || error.message === "下载已取消";
    if (!isAbort && clientConnected) {
      console.error("[WS] Update error:", error);
      send({ event: "error", message: error.message });
    }
  } finally {
    clearTimeout(timeout);
    ws.close();
  }
}

export default defineNitroPlugin((nitroApp: any) => {
  console.log("[WS Plugin] Initializing WebSocket server...");

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
    console.log("[WS] Client connected");

    const url = new URL(request.url || "", `http://${request.headers.host}`);

    // 根据路径区分日志和更新
    if (url.pathname === "/ws/logs") {
      handleLogConnection(ws);
    } else if (url.pathname === "/ws/update") {
      handleUpdateConnection(ws, url);
    } else {
      ws.close();
    }
  });

  // 创建独立的 HTTP 服务器处理 WebSocket
  const wsServer = createServer();

  wsServer.on(
    "upgrade",
    (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);

      if (url.pathname === "/ws/logs" || url.pathname === "/ws/update") {
        console.log("[WS] Upgrade request for", url.pathname);
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    },
  );

  const WS_PORT = (Number(process.env.wizard_admin_port) || 3000) + 1;
  wsServer.listen(WS_PORT, () => {
    console.log(`[WS Plugin] WebSocket server listening on port ${WS_PORT}`);
  });

  // 监听服务器关闭事件
  nitroApp.hooks.hook("close", async () => {
    wss.close();
    wsServer.close();
    console.log("[WS Plugin] WebSocket servers closed");
  });
});
