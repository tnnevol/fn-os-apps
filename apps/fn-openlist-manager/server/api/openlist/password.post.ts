import {
  getOpenlistBin,
  getDataDir,
  getOpenlistDataDir,
} from "../../utils/openlist";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname } from "node:path";

const execFileAsync = promisify(execFile);

export default defineEventHandler(async (event) => {
  const { action, password } = await readBody(event);
  const bin = getOpenlistBin();
  const binDir = dirname(bin);
  const dataDir = getDataDir();
  const openlistDataDir = getOpenlistDataDir();
  console.log("dataDir", dataDir);

  if (action === "random") {
    // 在前端生成随机密码
    const length = 12;
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      password += chars[randomIndex];
    }

    return { password };
  }

  if (action === "set" && password) {
    console.log(
      "[password] set bin:",
      bin,
      "dir:",
      openlistDataDir,
      "pwd:",
      password,
    );
    try {
      await execFileAsync(
        bin,
        ["admin", "set", password, "--data", openlistDataDir],
        {
          cwd: openlistDataDir,
        },
      );
      return { success: true };
    } catch (error: any) {
      console.error("[password] set error:", error);
      throw createError({ statusCode: 500, message: error.message });
    }
  }

  throw createError({ statusCode: 400, message: "无效操作" });
});
