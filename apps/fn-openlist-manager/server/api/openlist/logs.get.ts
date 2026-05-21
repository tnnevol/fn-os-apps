import { getOpenlistDataDir } from "../../utils/openlist";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export default defineEventHandler(async (event) => {
  const openlistDataDir = getOpenlistDataDir();
  const logFile = join(openlistDataDir, "log", "log.log");

  if (!existsSync(logFile)) {
    setHeader(event, "Content-Type", "text/event-stream");
    event.node.res.write(`data: ${JSON.stringify({ lines: [] })}\n\n`);
    return event.node.res;
  }

  setHeader(event, "Content-Type", "text/event-stream");
  setHeader(event, "Cache-Control", "no-cache");
  setHeader(event, "Connection", "keep-alive");
  setHeader(event, "X-Accel-Buffering", "no");

  // First send last 200 lines
  let buffer = "";
  const head = spawn("tail", ["-n", "200", logFile]);
  head.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
  });

  await new Promise<void>((resolve) => {
    head.on("close", () => {
      const lines = buffer.split("\n").filter(Boolean);
      event.node.res.write(`data: ${JSON.stringify({ lines })}\n\n`);
      resolve();
    });
  });

  // Then follow new lines via tail -f
  let lineBuffer = "";
  const tail = spawn("tail", ["-f", logFile]);

  const sendLine = (line: string) => {
    if (line.trim()) {
      event.node.res.write(`data: ${JSON.stringify({ line })}\n\n`);
    }
  };

  tail.stdout.on("data", (chunk) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() || "";
    lines.forEach(sendLine);
  });

  tail.stderr.on("data", () => {
    // ignore tail stderr
  });

  // Cleanup on client disconnect
  event.node.req.on("close", () => {
    tail.kill();
    head.kill();
  });

  return event.node.res;
});
