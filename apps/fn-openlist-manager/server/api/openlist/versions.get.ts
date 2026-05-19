import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default defineEventHandler(async () => {
  try {
    const { stdout } = await execAsync(
      `curl -sL "https://github.com/OpenListTeam/OpenList/releases" | grep -oE 'tag/v[0-9]+\\.[0-9]+\\.[0-9]+' | sed 's/tag\\///' | sort -uVr | head -10`,
    );

    const versions = stdout
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v);

    return { versions };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `获取版本列表失败: ${error.message}`,
    });
  }
});
