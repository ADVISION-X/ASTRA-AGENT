import type { LocalAiConfig, LocalAiReadinessResult } from "./contract.js";
import { loadLocalAiConfig } from "./config.js";
import { listAvailableModels } from "./ollama-client.js";

export async function checkLocalAiReadiness(config?: LocalAiConfig): Promise<LocalAiReadinessResult> {
  const checkedAt = new Date().toISOString();

  let resolvedConfig: LocalAiConfig;
  try {
    resolvedConfig = config ?? await loadLocalAiConfig();
  } catch (error) {
    return {
      status: "unavailable",
      endpointReachable: false,
      modelConfigured: false,
      modelAvailable: false,
      detail: `Local AI config load failed: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt,
    };
  }

  if (!resolvedConfig.enabled) {
    return {
      status: "unavailable",
      endpointReachable: false,
      modelConfigured: true,
      modelAvailable: false,
      detail: "Local AI is disabled by configuration.",
      checkedAt,
    };
  }

  let availableModels: string[];
  try {
    availableModels = await listAvailableModels(resolvedConfig.endpoint);
  } catch (error) {
    return {
      status: "unavailable",
      endpointReachable: false,
      modelConfigured: true,
      modelAvailable: false,
      detail: `Ollama endpoint unreachable at ${resolvedConfig.endpoint}: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt,
    };
  }

  const modelAvailable = availableModels.includes(resolvedConfig.modelName);
  if (!modelAvailable) {
    return {
      status: "degraded",
      endpointReachable: true,
      modelConfigured: true,
      modelAvailable: false,
      detail: `Model ${resolvedConfig.modelName} is not installed. Available: ${availableModels.join(", ") || "none"}`,
      checkedAt,
    };
  }

  return {
    status: "ready",
    endpointReachable: true,
    modelConfigured: true,
    modelAvailable: true,
    detail: `Local AI ready: ${resolvedConfig.runtimeName}/${resolvedConfig.modelName} at ${resolvedConfig.endpoint}`,
    checkedAt,
  };
}
