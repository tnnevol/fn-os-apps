import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getOpenlistDataDir } from "../utils/openlist";

export default defineNitroPlugin((nitroApp: any) => {
  console.log("[WS Plugin] Initializing WebSocket server...");

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] Client connected");

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
  });

  // 创建独立的 HTTP 服务器处理 WebSocket
  const wsServer = createServer();

  wsServer.on(
    "upgrade",
    (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const url = new URL(request.url || "", `http://${request.headers.host}`);

      if (url.pathname === "/ws/logs") {
        console.log("[WS] Upgrade request for", url.pathname);
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    },
  );

  const WS_PORT = 3001;
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
