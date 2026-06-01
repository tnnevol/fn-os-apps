/**
 * 获取当前访问的主机名
 * 在浏览器环境中使用 location.hostname
 * 在服务端环境中使用 os.hostname()
 */
export function useLocalIp() {
  // 浏览器环境：使用当前访问的 hostname
  if (typeof window !== "undefined") {
    return window.location.hostname;
  }

  // 服务端环境：使用 Node.js 获取
  try {
    const { hostname } = require("node:os");
    return hostname();
  } catch {
    return "127.0.0.1";
  }
}
