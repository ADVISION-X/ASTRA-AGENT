import { spawn } from "node:child_process";

import { loadLocalAiModelConfig, type LocalAiModelConfig, type LocalModelRoleConfig } from "./model-config.js";
import { LocalAiGateway } from "./local-ai-gateway.js";
import {
  LocalAiStartupReadinessSchema,
  type LocalAiDependencyStatus,
  type LocalAiHealth,
  type LocalAiStartupFailureReason,
  type LocalAiStartupReadiness,
  type LocalAiStartupRoleHealth,
} from "../../types/local-ai.js";

const DEFAULT_OLLAMA_BASE_URL = process.env.GRASSEYE_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

type RuntimeProbe = {
  ok: boolean;
  availableModels: string[];
  error: string | null;
  timedOut: boolean;
};

type LocalAiStartupReadinessOptions = {
  baseUrl?: string;
  appWarmupMs?: number;
  readyTimeoutMs?: number;
  pollIntervalMs?: number;
  allowRecovery?: boolean;
  logger?: (message: string) => void;
};

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function probeOllamaRuntime(baseUrl: string): Promise<RuntimeProbe> {
  try {
    const payload = await fetchJsonWithTimeout(`${baseUrl}/api/tags`, 5_000) as { models?: Array<{ name?: string | null }> };
    const availableModels = Array.isArray(payload.models)
      ? payload.models.map((entry) => entry?.name?.trim?.() ?? "").filter((name) => name.length > 0)
      : [];
    return { ok: true, availableModels, error: null, timedOut: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      availableModels: [],
      error: message,
      timedOut: /abort|timed out/i.test(message),
    };
  }
}

async function waitForOllamaRuntime(baseUrl: string, timeoutMs: number, intervalMs: number): Promise<RuntimeProbe> {
  const deadline = Date.now() + timeoutMs;
  let lastProbe = await probeOllamaRuntime(baseUrl);

  while (!lastProbe.ok && Date.now() < deadline) {
    await sleep(intervalMs);
    lastProbe = await probeOllamaRuntime(baseUrl);
  }

  return lastProbe.ok ? lastProbe : { ...lastProbe, timedOut: true };
}

async function spawnDetached(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function classifyProbeFailure(probe: RuntimeProbe, recoveryAttempted: boolean): LocalAiStartupFailureReason {
  if (probe.timedOut) {
    return "LOCAL_AI_READINESS_TIMEOUT";
  }
  return recoveryAttempted ? "LOCAL_AI_RUNTIME_START_FAILED" : "LOCAL_AI_RUNTIME_NOT_FOUND";
}

function toRoleHealth(status: LocalAiDependencyStatus): LocalAiStartupRoleHealth {
  if (status === "ready") {
    return "ready";
  }
  return status === "missing" ? "missing" : "unhealthy";
}

function resolveRoleStatus(health: LocalAiHealth, role: LocalModelRoleConfig["role"]): LocalAiDependencyStatus {
  if (role === "vision") {
    return health.visionModelStatus;
  }
  if (role === "commentUnderstanding") {
    return health.textModelStatus;
  }
  if (role === "productSignal") {
    return health.productSignalModelStatus;
  }
  return health.ocrStatus;
}

function resolveRoleFailureReason(input: {
  roleHealth: LocalAiStartupRoleHealth;
  roleRuntime: LocalModelRoleConfig["runtime"];
  probeFailureReason: LocalAiStartupFailureReason | null;
}): LocalAiStartupFailureReason | null {
  if (input.roleHealth === "ready") {
    return null;
  }
  if (input.roleHealth === "missing") {
    return "LOCAL_AI_MODEL_MISSING";
  }
  return input.roleRuntime === "ollama" && input.probeFailureReason !== null
    ? input.probeFailureReason
    : "LOCAL_AI_MODEL_UNHEALTHY";
}

function buildFallbackModelRoles(failureReason: LocalAiStartupFailureReason) {
  return LocalAiStartupReadinessSchema.shape.modelRoles.parse([
    { modelRole: "vision", modelName: "unknown", provider: "local", runtime: "ollama", health: "unhealthy", failureReason },
    { modelRole: "ocr", modelName: "unknown", provider: "local", runtime: "local-ocr", health: "unhealthy", failureReason },
    { modelRole: "commentUnderstanding", modelName: "unknown", provider: "local", runtime: "ollama", health: "unhealthy", failureReason },
    { modelRole: "productSignal", modelName: "unknown", provider: "local", runtime: "ollama", health: "unhealthy", failureReason },
  ]);
}

function buildReadinessDetail(modelRoles: LocalAiStartupReadiness["modelRoles"], failureReason: LocalAiStartupFailureReason | null): string {
  const roleSummary = modelRoles.map((role) => `${role.modelRole}=${role.health}:${role.modelName}`).join("; ");
  return failureReason === null ? `local-ai startup ready; ${roleSummary}` : `${failureReason}; ${roleSummary}`;
}

function buildReadinessResult(input: {
  baseUrl: string;
  modelRoles: LocalAiStartupReadiness["modelRoles"];
  failureReason: LocalAiStartupFailureReason | null;
  detail: string;
}): LocalAiStartupReadiness {
  return LocalAiStartupReadinessSchema.parse({
    component: "local-ai-runtime",
    status: input.failureReason === null ? "ready" : "failed",
    runtimeBaseUrl: input.baseUrl,
    detail: input.detail,
    modelRoles: input.modelRoles,
    missionRuntimeAvailable: input.failureReason === null,
    failureReason: input.failureReason,
    developmentOnly: false,
    checkedAt: new Date().toISOString(),
  });
}

async function recoverOllamaRuntime(input: Required<Pick<LocalAiStartupReadinessOptions, "allowRecovery" | "appWarmupMs" | "readyTimeoutMs" | "pollIntervalMs" | "logger">> & { baseUrl: string }) {
  const initialProbe = await probeOllamaRuntime(input.baseUrl);
  if (initialProbe.ok || !input.allowRecovery) {
    return { probe: initialProbe, recoveryAttempted: false };
  }

  input.logger("Local AI runtime unavailable; attempting to open the Ollama app.");
  try {
    await spawnDetached("open", ["-a", "Ollama"]);
    await sleep(input.appWarmupMs);
    const appProbe = await waitForOllamaRuntime(input.baseUrl, input.readyTimeoutMs, input.pollIntervalMs);
    if (appProbe.ok) {
      return { probe: appProbe, recoveryAttempted: true };
    }
  } catch (error) {
    input.logger(error instanceof Error ? error.message : String(error));
  }

  input.logger("Ollama app did not recover the runtime; attempting detached 'ollama serve'.");
  try {
    await spawnDetached("ollama", ["serve"]);
    const serveProbe = await waitForOllamaRuntime(input.baseUrl, input.readyTimeoutMs, input.pollIntervalMs);
    return { probe: serveProbe, recoveryAttempted: true };
  } catch (error) {
    return {
      probe: {
        ok: false,
        availableModels: [],
        error: error instanceof Error ? error.message : String(error),
        timedOut: false,
      },
      recoveryAttempted: true,
    };
  }
}

function buildModelRoles(modelConfig: LocalAiModelConfig, health: LocalAiHealth, probeFailureReason: LocalAiStartupFailureReason | null) {
  return LocalAiStartupReadinessSchema.shape.modelRoles.parse(
    Object.values(modelConfig.roles).map((roleConfig) => {
      const roleHealth = toRoleHealth(resolveRoleStatus(health, roleConfig.role));
      return {
        modelRole: roleConfig.role,
        modelName: roleConfig.model,
        provider: roleConfig.provider,
        runtime: roleConfig.runtime,
        health: roleHealth,
        failureReason: resolveRoleFailureReason({ roleHealth, roleRuntime: roleConfig.runtime, probeFailureReason }),
      };
    }),
  );
}

function resolveTopLevelFailureReason(modelRoles: LocalAiStartupReadiness["modelRoles"], health: LocalAiHealth, probeFailureReason: LocalAiStartupFailureReason | null) {
  if (health.ollamaStatus !== "ready" && probeFailureReason !== null) {
    return probeFailureReason;
  }
  if (modelRoles.some((role) => role.health === "missing")) {
    return "LOCAL_AI_MODEL_MISSING";
  }
  return modelRoles.some((role) => role.health === "unhealthy") ? "LOCAL_AI_MODEL_UNHEALTHY" : null;
}

export async function getLocalAiStartupReadiness(options: LocalAiStartupReadinessOptions = {}): Promise<LocalAiStartupReadiness> {
  const baseUrl = options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;

  let modelConfig: LocalAiModelConfig;
  try {
    modelConfig = await loadLocalAiModelConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildReadinessResult({
      baseUrl,
      modelRoles: buildFallbackModelRoles("LOCAL_AI_MODEL_MISSING"),
      failureReason: "LOCAL_AI_MODEL_MISSING",
      detail: `LOCAL_AI_MODEL_MISSING; ${message}`,
    });
  }

  const { probe, recoveryAttempted } = await recoverOllamaRuntime({
    baseUrl,
    allowRecovery: options.allowRecovery ?? true,
    appWarmupMs: options.appWarmupMs ?? 8_000,
    readyTimeoutMs: options.readyTimeoutMs ?? 20_000,
    pollIntervalMs: options.pollIntervalMs ?? 500,
    logger: options.logger ?? (() => {}),
  });
  const probeFailureReason = probe.ok ? null : classifyProbeFailure(probe, recoveryAttempted);
  const gateway = new LocalAiGateway({ modelConfig });
  const health = await gateway.getRuntimeHealth();
  const modelRoles = buildModelRoles(modelConfig, health, probeFailureReason);
  const failureReason = resolveTopLevelFailureReason(modelRoles, health, probeFailureReason);
  return buildReadinessResult({
    baseUrl,
    modelRoles,
    failureReason,
    detail: buildReadinessDetail(modelRoles, failureReason),
  });
}