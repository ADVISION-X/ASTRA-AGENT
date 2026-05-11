import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import type { LocalAiConfig } from "./contract.js";

const LocalAiConfigSchema = z.object({
  runtimeName: z.literal("ollama"),
  endpoint: z.string().min(1),
  modelName: z.string().min(1),
  timeoutMs: z.number().positive(),
  enabled: z.boolean(),
});

const findRepoRoot = (startDir: string): string => {
  let currentDir = startDir;
  while (true) {
    if (existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not resolve GrassEye repository root from local AI config loader.");
    }
    currentDir = parentDir;
  }
};

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_CONFIG_PATH = path.join(repoRoot, "config", "local-ai.models.json");

export async function loadLocalAiConfig(configPath = DEFAULT_CONFIG_PATH): Promise<LocalAiConfig> {
  let text: string;
  try {
    text = await readFile(configPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read local AI config at ${configPath}: ${message}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Local AI config is not valid JSON at ${configPath}: ${message}`);
  }

  try {
    return LocalAiConfigSchema.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Local AI config is invalid at ${configPath}: ${message}`);
  }
}
