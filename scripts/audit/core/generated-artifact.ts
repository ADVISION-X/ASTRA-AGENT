import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { generatedHome } from "./path-roots.js";

const generatedPath = (fileName: string): string => join(generatedHome, fileName);

export const readGeneratedJson = <T>(fileName: string): T => {
  const targetPath = generatedPath(fileName);
  return JSON.parse(readFileSync(targetPath, "utf8")) as T;
};

export const writeGeneratedJson = (fileName: string, value: unknown): void => {
  const targetPath = generatedPath(fileName);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
};