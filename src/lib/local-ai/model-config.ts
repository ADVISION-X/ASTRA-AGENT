import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { LocalAiModelRoleSchema, LocalAiRuntimeSchema } from "../../types/local-ai.js";

const FailureBehaviorSchema = z.enum(["retry", "skip", "operatorReview", "candidateReview"]);

const LocalModelRoleConfigSchema = z.object({
  role: LocalAiModelRoleSchema,
  provider: z.literal("local"),
  runtime: LocalAiRuntimeSchema,
  model: z.string().trim().min(1),
  executionMode: z.literal("local-only"),
  promptVersion: z.string().trim().min(1),
  schemaVersion: z.string().trim().min(1),
  failureBehavior: FailureBehaviorSchema,
  requiredForPhase: z.literal("phase-04"),
  allowMock: z.literal(false),
  allowCloudFallback: z.literal(false),
}).strict();

const LocalAiModelConfigSchema = z.object({
  version: z.string().trim().min(1),
  phase: z.literal("phase-04"),
  executionPosture: z.literal("local-only"),
  allowCloudFallback: z.literal(false),
  allowPaidApi: z.literal(false),
  allowMockForAcceptance: z.literal(false),
  roles: z.object({
    vision: LocalModelRoleConfigSchema.extend({ role: z.literal("vision") }).strict(),
    ocr: LocalModelRoleConfigSchema.extend({ role: z.literal("ocr") }).strict(),
    commentUnderstanding: LocalModelRoleConfigSchema.extend({ role: z.literal("commentUnderstanding") }).strict(),
    productSignal: LocalModelRoleConfigSchema.extend({ role: z.literal("productSignal") }).strict(),
  }).strict(),
}).strict();

const findRepoRoot = (startDir: string): string => {
  let currentDir = startDir;

  while (true) {
    if (existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not resolve GrassEye repository root from local-ai model config loader.");
    }

    currentDir = parentDir;
  }
};

const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
export const DEFAULT_LOCAL_AI_MODEL_CONFIG_PATH = path.join(repoRoot, "config", "local-ai.models.json");

export type LocalModelRole = z.infer<typeof LocalAiModelRoleSchema>;
export type LocalModelRoleConfig = z.infer<typeof LocalModelRoleConfigSchema>;
export type LocalAiModelConfig = z.infer<typeof LocalAiModelConfigSchema>;

export function validateLocalAiModelConfig(input: unknown): LocalAiModelConfig {
  return LocalAiModelConfigSchema.parse(input);
}

export async function loadLocalAiModelConfig(configPath = DEFAULT_LOCAL_AI_MODEL_CONFIG_PATH): Promise<LocalAiModelConfig> {
  let configText: string;

  try {
    configText = await readFile(configPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read local AI model config at ${configPath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Local AI model config is not valid JSON at ${configPath}: ${message}`);
  }

  try {
    return validateLocalAiModelConfig(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Local AI model config is invalid at ${configPath}: ${message}`);
  }
}

export function getModelRoleConfig(config: LocalAiModelConfig, role: LocalModelRole): LocalModelRoleConfig {
  const roleConfig = config.roles[role];
  if (!roleConfig) {
    throw new Error(`Missing local AI model role config for ${role}.`);
  }

  return roleConfig;
}
