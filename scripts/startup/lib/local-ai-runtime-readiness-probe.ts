import { spawn } from "node:child_process";
import { checkLocalAiReadiness, loadLocalAiConfig } from "../../../src/lib/local-ai/index.js";
import type { LocalAiConfig } from "../../../src/lib/local-ai/index.js";

const ALLOW_RECOVERY = process.env.GRASSEYE_LOCAL_AI_ALLOW_RECOVERY === "1";
const APP_WARMUP_MS = Number(process.env.GRASSEYE_LOCAL_AI_APP_WARMUP_MS ?? "8000");
const READY_TIMEOUT_MS = Number(process.env.GRASSEYE_LOCAL_AI_READY_TIMEOUT_MS ?? "20000");
const POLL_INTERVAL_MS = Number(process.env.GRASSEYE_LOCAL_AI_POLL_INTERVAL_MS ?? "500");

function isEndpointReachable(endpoint: string): Promise<boolean> {
  return fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3000) })
    .then(() => true)
    .catch(() => false);
}

async function waitForEndpoint(endpoint: string, timeoutMs: number, pollIntervalMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isEndpointReachable(endpoint)) return true;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

function spawnOllamaServe(): void {
  // Detached — we do not own the process; it survives the probe lifecycle.
  const child = spawn("ollama", ["serve"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function attemptOllamaRecovery(endpoint: string): Promise<boolean> {
  process.stderr.write(`[local-ai-probe] Ollama not reachable at ${endpoint}. Attempting auto-start (GRASSEYE_LOCAL_AI_ALLOW_RECOVERY=1).\n`);
  spawnOllamaServe();
  // Give Ollama a brief warmup before polling.
  await new Promise((r) => setTimeout(r, Math.min(APP_WARMUP_MS, READY_TIMEOUT_MS)));
  const reached = await waitForEndpoint(endpoint, READY_TIMEOUT_MS - APP_WARMUP_MS, POLL_INTERVAL_MS);
  if (reached) {
    process.stderr.write(`[local-ai-probe] Ollama became reachable after auto-start.\n`);
  } else {
    process.stderr.write(`[local-ai-probe] Ollama did not become reachable within ${READY_TIMEOUT_MS}ms after auto-start.\n`);
  }
  return reached;
}

async function main(): Promise<void> {
  const endpointOverride = process.env.GRASSEYE_OLLAMA_BASE_URL;

  let config: LocalAiConfig;
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

  // If Ollama is not reachable and recovery is allowed, attempt auto-start.
  if (ALLOW_RECOVERY) {
    const initiallyReachable = await isEndpointReachable(config.endpoint);
    if (!initiallyReachable) {
      const recovered = await attemptOllamaRecovery(config.endpoint);
      if (!recovered) {
        const output = {
          component: "local-ai-runtime",
          status: "failed",
          runtimeBaseUrl: config.endpoint,
          detail: `Ollama endpoint unreachable at ${config.endpoint}: auto-start attempted but Ollama did not become ready within ${READY_TIMEOUT_MS}ms. Run: ollama serve`,
          modelRoles: [
            {
              modelRole: "vision",
              modelName: config.modelName,
              provider: "local",
              runtime: config.runtimeName,
              health: "unhealthy",
              failureReason: "LOCAL_AI_NOT_READY",
            },
          ],
          missionRuntimeAvailable: false,
          failureReason: "LOCAL_AI_NOT_READY",
          developmentOnly: false,
          checkedAt: new Date().toISOString(),
        };
        process.stdout.write(`${JSON.stringify(output)}\n`);
        process.exitCode = 1;
        return;
      }
    }
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