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

function secretLast4(apiKey: string): string | null {
  const suffix = apiKey.slice(-4);
  return suffix || null;
}

function resolveMissingReason(config: AiExternalProviderConfig): string | null {
  const checks: Array<[boolean, string]> = [
    [!config.enabled, "provider_disabled"],
    [!config.allowPaidProvider, "paid_provider_not_allowed"],
    [!config.dataPolicy.allowExternalTransmission, "external_transmission_approval_missing"],
    [!config.operatorApprovalRef, "operator_approval_missing"],
    [!config.secretRef || !config.apiKey, "provider_secret_missing"],
  ];
  return checks.find(([blocked]) => blocked)?.[1] ?? null;
}

function toPublicState(config: AiExternalProviderConfig | null): AiExternalProviderPublicState {
  if (config === null) {
    return AiExternalProviderPublicStateSchema.parse({
      providerId: "openai-compatible",
      configured: false,
      enabled: false,
      missingReason: "provider_config_missing",
    });
  }

  return AiExternalProviderPublicStateSchema.parse({
    providerId: config.providerId,
    displayName: config.displayName,
    providerKind: config.providerKind,
    providerCompany: config.providerCompany,
    configured: true,
    enabled: config.enabled,
    configRef: config.configRef,
    secretRef: config.secretRef,
    hasSecret: true,
    secretLast4: secretLast4(config.apiKey),
    model: config.model,
    allowPaidProvider: config.allowPaidProvider,
    allowExternalTransmission: config.dataPolicy.allowExternalTransmission,
    maxEstimatedCost: config.costPolicy.maxEstimatedCost,
    operatorApprovalRef: config.operatorApprovalRef,
    missingReason: resolveMissingReason(config),
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
  input: {
    displayName?: string | null;
    providerKind?: string | null;
    providerCompany?: "openai" | "deepseek" | "openrouter" | null;
    baseUrl: string;
    model: string;
    apiKey: string;
    allowPaidProvider?: boolean;
    providerAllowlist?: ["paid-analysis-ai"] | string[];
    dataPolicy?: { allowExternalTransmission?: boolean };
    costPolicy?: { maxEstimatedCost?: number };
    operatorApprovalRef?: string | null;
    approvalReason?: string | null;
    enabled?: boolean;
    updatedAt: string;
  },
): Promise<AiExternalProviderPublicState> {
  const filePath = resolveProviderConfigPath(dataDir);
  const config = AiExternalProviderConfigSchema.parse({
    providerId: "openai-compatible",
    displayName: input.displayName?.trim() || null,
    providerKind: "openai-compatible",
    providerCompany: input.providerCompany ?? "openai",
    configRef: DEFAULT_CONFIG_REF,
    secretRef: DEFAULT_SECRET_REF,
    baseUrl: trimTrailingSlash(input.baseUrl.trim()),
    model: input.model.trim(),
    apiKey: input.apiKey.trim(),
    allowPaidProvider: input.allowPaidProvider ?? true,
    providerAllowlist: ["paid-analysis-ai"],
    dataPolicy: { allowExternalTransmission: input.dataPolicy?.allowExternalTransmission ?? true },
    costPolicy: { maxEstimatedCost: input.costPolicy?.maxEstimatedCost ?? 5 },
    operatorApprovalRef: input.operatorApprovalRef?.trim() || null,
    approvalReason: input.approvalReason?.trim() || null,
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
