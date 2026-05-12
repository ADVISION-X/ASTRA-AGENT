import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

const ONLINE_AI_PROVIDER_PATH = ["config", "online-ai-provider.json"] as const;
const LOCKED_GEMINI_MODEL = "gemini-2.5-flash-lite" as const;

const OnlineAiProviderConfigSchema = z.object({
  providerCompany: z.literal("google"),
  providerKind: z.literal("gemini-api"),
  displayName: z.string().min(1),
  apiKey: z.string().min(10),
  modelName: z.literal(LOCKED_GEMINI_MODEL).default(LOCKED_GEMINI_MODEL),
  endpoint: z.string().url().default("https://generativelanguage.googleapis.com/v1beta"),
  updatedAt: z.string().min(1).nullable().default(null),
}).strict();

export type OnlineAiProviderConfig = z.infer<typeof OnlineAiProviderConfigSchema>;

export type OnlineAiProviderPublicStatus = {
  providerCompany: "google";
  providerKind: "gemini-api";
  displayName: string;
  modelName: string;
  endpoint: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  updatedAt: string | null;
};

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

async function safeChmod(filePath: string): Promise<void> {
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Some local filesystems do not support chmod; the file still stays local-only.
  }
}

function resolveConfigPath(dataDir: string): string {
  return join(dataDir, ...ONLINE_AI_PROVIDER_PATH);
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 10) return "********";
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

export function toPublicOnlineAiProviderStatus(config: OnlineAiProviderConfig): OnlineAiProviderPublicStatus {
  return {
    providerCompany: config.providerCompany,
    providerKind: config.providerKind,
    displayName: config.displayName,
    modelName: config.modelName,
    endpoint: config.endpoint,
    hasApiKey: true,
    maskedApiKey: maskApiKey(config.apiKey),
    updatedAt: config.updatedAt,
  };
}

export async function loadOnlineAiProviderConfig(dataDir: string): Promise<OnlineAiProviderConfig> {
  const envKey = process.env.GRASSEYE_GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const filePath = resolveConfigPath(dataDir);
  const raw = await safeReadFile(filePath);
  if (raw) {
    return OnlineAiProviderConfigSchema.parse(JSON.parse(raw));
  }
  if (envKey) {
    return OnlineAiProviderConfigSchema.parse({
      providerCompany: "google",
      providerKind: "gemini-api",
      displayName: "Google Gemini",
      apiKey: envKey,
      modelName: LOCKED_GEMINI_MODEL,
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      updatedAt: null,
    });
  }
  throw new Error("Online AI API key is not configured. Save a Google Gemini API key in Settings.");
}

export async function loadOnlineAiProviderPublicStatus(dataDir: string): Promise<OnlineAiProviderPublicStatus> {
  const config = await loadOnlineAiProviderConfig(dataDir);
  return toPublicOnlineAiProviderStatus(config);
}

export async function saveOnlineAiProviderConfig(
  dataDir: string,
  input: {
    displayName?: string | null;
    apiKey: string;
    modelName?: string | null;
  },
): Promise<OnlineAiProviderPublicStatus> {
  const filePath = resolveConfigPath(dataDir);
  await mkdir(dirname(filePath), { recursive: true });
  const config = OnlineAiProviderConfigSchema.parse({
    providerCompany: "google",
    providerKind: "gemini-api",
    displayName: input.displayName?.trim() || "Google Gemini",
    apiKey: input.apiKey.trim(),
    modelName: LOCKED_GEMINI_MODEL,
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    updatedAt: new Date().toISOString(),
  });
  await writeFile(filePath, JSON.stringify(config, null, 2), "utf8");
  await safeChmod(filePath);
  return toPublicOnlineAiProviderStatus(config);
}

export { LOCKED_GEMINI_MODEL };
