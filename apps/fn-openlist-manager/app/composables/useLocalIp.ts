/**
 * 获取当前访问的主机名
 * 在浏览器环境中使用 location.hostname
 */
export function useLocalIp() {
  // 浏览器环境：使用当前访问的 hostname
  if (typeof window !== "undefined") {
    return window.location.hostname;
  }
  
  // 非浏览器环境返回空字符串
  return "";
}
