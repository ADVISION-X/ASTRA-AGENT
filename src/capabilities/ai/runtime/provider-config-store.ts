import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  AiExternalProviderConfigSchema,
  AiExternalProviderPublicStateSchema,
  type AiExternalProviderConfig,
  type AiExternalProviderPublicState,
} from "./provider-config-schema.js";

const PROVIDER_CONFIG_RELATIVE_PATH = ["config", "ai-provider.openai-compatible.json"] as const;
const DEFAULT_CONFIG_REF = "provider-config:openai-compatible:default";
const DEFAULT_SECRET_REF = "provider-secret:openai-compatible:default";

function resolveProviderConfigPath(dataDir: string): string {
  return join(dataDir, ...PROVIDER_CONFIG_RELATIVE_PATH);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

function isIgnorablePermissionError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error
    && "code" in error
    && ["EPERM", "ENOTSUP", "EROFS", "EINVAL"].includes(String(error.code ?? ""));
}

function maskApiKey(apiKey: string): string {
  const suffix = apiKey.slice(-4);
  return suffix ? `••••${suffix}` : "••••";
}

function toPublicState(config: AiExternalProviderConfig | null): AiExternalProviderPublicState {
  if (config === null) {
    return AiExternalProviderPublicStateSchema.parse({
      providerId: "openai-compatible",
      configured: false,
      enabled: false,
    });
  }

  return AiExternalProviderPublicStateSchema.parse({
    providerId: config.providerId,
    configured: true,
    enabled: config.enabled,
    configRef: config.configRef,
    secretRef: config.secretRef,
    baseUrl: config.baseUrl,
    model: config.model,
    maskedApiKey: maskApiKey(config.apiKey),
    updatedAt: config.updatedAt,
  });
}

async function readProviderConfig(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

async function ensureConfigParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function lockFilePermissions(path: string): Promise<void> {
  try {
    await chmod(path, 0o600);
  } catch (error) {
    if (isIgnorablePermissionError(error)) {
      return;
    }

    throw error;
  }
}

export async function loadAiExternalProviderConfig(dataDir: string): Promise<AiExternalProviderConfig | null> {
  const filePath = resolveProviderConfigPath(dataDir);
  const content = await readProviderConfig(filePath);
  if (content === null) {
    return null;
  }
  return AiExternalProviderConfigSchema.parse(JSON.parse(content));
}

export async function saveAiExternalProviderConfig(
  dataDir: string,
  input: { baseUrl: string; model: string; apiKey: string; enabled?: boolean; updatedAt: string },
): Promise<AiExternalProviderPublicState> {
  const filePath = resolveProviderConfigPath(dataDir);
  const config = AiExternalProviderConfigSchema.parse({
    providerId: "openai-compatible",
    configRef: DEFAULT_CONFIG_REF,
    secretRef: DEFAULT_SECRET_REF,
    baseUrl: trimTrailingSlash(input.baseUrl.trim()),
    model: input.model.trim(),
    apiKey: input.apiKey.trim(),
    enabled: input.enabled ?? true,
    updatedAt: input.updatedAt,
  });

  await ensureConfigParent(filePath);
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await lockFilePermissions(filePath);
  return toPublicState(config);
}

export async function getAiExternalProviderPublicState(dataDir: string): Promise<AiExternalProviderPublicState> {
  return toPublicState(await loadAiExternalProviderConfig(dataDir));
}

export async function resolveAiExternalProviderRuntimeConfig(
  dataDir: string,
  refs: { providerConfigRef?: string | null; secretRef?: string | null } = {},
): Promise<AiExternalProviderConfig | null> {
  const config = await loadAiExternalProviderConfig(dataDir);
  if (config === null || !config.enabled) {
    return null;
  }
  if (refs.providerConfigRef && refs.providerConfigRef !== config.configRef) {
    return null;
  }
  if (refs.secretRef && refs.secretRef !== config.secretRef) {
    return null;
  }
  return config;
}
