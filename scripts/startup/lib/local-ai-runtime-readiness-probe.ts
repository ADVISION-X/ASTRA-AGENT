import { checkLocalAiReadiness, loadLocalAiConfig } from "../../../src/lib/local-ai/index.js";

async function main(): Promise<void> {
  const endpointOverride = process.env.GRASSEYE_OLLAMA_BASE_URL;

  let config;
  try {
    config = await loadLocalAiConfig();
    if (endpointOverride) {
      config = { ...config, endpoint: endpointOverride };
    }
  } catch (error) {
    const output = {
      component: "local-ai-runtime",
      status: "failed",
      runtimeBaseUrl: endpointOverride ?? "http://127.0.0.1:11434",
      detail: error instanceof Error ? error.message : String(error),
      modelRoles: [],
      missionRuntimeAvailable: false,
      failureReason: "LOCAL_AI_NOT_READY",
      developmentOnly: false,
      checkedAt: new Date().toISOString(),
    };
    process.stdout.write(`${JSON.stringify(output)}\n`);
    process.exitCode = 1;
    return;
  }

  const result = await checkLocalAiReadiness(config);
  const roleHealth = result.modelAvailable ? "ready" : result.endpointReachable ? "missing" : "unhealthy";
  const topStatus = result.status === "ready" ? "ready" : result.status === "degraded" ? "degraded" : "failed";

  const output = {
    component: "local-ai-runtime",
    status: topStatus,
    runtimeBaseUrl: config.endpoint,
    detail: result.detail,
    modelRoles: [
      {
        modelRole: "vision",
        modelName: config.modelName,
        provider: "local",
        runtime: config.runtimeName,
        health: roleHealth,
        failureReason: result.status !== "ready" ? "LOCAL_AI_NOT_READY" : null,
      },
    ],
    missionRuntimeAvailable: result.status === "ready",
    failureReason: result.status !== "ready" ? "LOCAL_AI_NOT_READY" : null,
    developmentOnly: false,
    checkedAt: result.checkedAt,
  };

  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = result.status === "ready" ? 0 : 1;
}

void main();