import { networkInterfaces } from "node:os";

/**
 * 获取设备的局域网 IP 地址
 * 优先返回 IPv4 地址，排除 127.0.0.1 和内部地址
 */
export function useLocalIp() {
  const interfaces = networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const details of iface) {
      // 跳过内部地址和非 IPv4
      if (details.internal || details.family !== "IPv4") continue;

      // 返回第一个有效的局域网 IP
      return details.address;
    }
  }

  // 如果找不到，返回 localhost 作为后备
  return "127.0.0.1";
}
