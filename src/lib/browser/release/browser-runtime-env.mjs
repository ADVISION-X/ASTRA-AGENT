import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const unquote = (value) => {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed.at(-1);
  return (first === "\"" && last === "\"") || (first === "'" && last === "'")
    ? trimmed.slice(1, -1)
    : trimmed;
};

const loadFile = (filePath, target) => {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!key || target[key] !== undefined) continue;
    target[key] = unquote(line.slice(separator + 1));
  }
};

export const loadBrowserRuntimeEnv = (rootDir, target = process.env) => {
  loadFile(path.join(rootDir, ".env.local"), target);
  loadFile(path.join(rootDir, ".env"), target);
  return target;
};

export const resolveBrowserRuntimeMode = (env = process.env) => {
  const mode = env.GRASSEYE_BROWSER_RUNTIME_MODE?.trim() || "production";
  if (mode !== "production" && mode !== "test") {
    throw new Error(`BROWSER_RUNTIME_MODE_INVALID:${mode}`);
  }
  return mode;
};
