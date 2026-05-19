import { getOpenlistBin } from "../../utils/openlist";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default defineEventHandler(async (event) => {
  const { action, password } = await readBody(event);
  const bin = getOpenlistBin();

  if (action === "random") {
    try {
      const { stdout } = await execAsync(`${bin} admin random`);
      const match = stdout.match(/password:\s*(\S+)/);
      return { password: match?.[1] || stdout.trim() };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message });
    }
  }

  if (action === "set" && password) {
    try {
      await execAsync(`${bin} admin set "${password}"`);
      return { success: true };
    } catch (error: any) {
      throw createError({ statusCode: 500, message: error.message });
    }
  }

  throw createError({ statusCode: 400, message: "无效操作" });
});
