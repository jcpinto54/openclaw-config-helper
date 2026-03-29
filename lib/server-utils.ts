import fs from "node:fs/promises";
import path from "node:path";

import { stableStringify } from "@/lib/utils";

export const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const writeJson = async (filePath: string, value: unknown) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${stableStringify(value)}\n`, "utf8");
};
