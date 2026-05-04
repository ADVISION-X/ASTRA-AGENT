import { getLocalAiStartupReadiness } from "../../../src/lib/local-ai/startup-readiness.js";

async function main(): Promise<void> {
  const baseUrl = process.env.GRASSEYE_OLLAMA_BASE_URL;
  const result = await getLocalAiStartupReadiness({
    ...(baseUrl ? { baseUrl } : {}),
    appWarmupMs: Number(process.env.GRASSEYE_LOCAL_AI_APP_WARMUP_MS ?? 8_000),
    readyTimeoutMs: Number(process.env.GRASSEYE_LOCAL_AI_READY_TIMEOUT_MS ?? 20_000),
    pollIntervalMs: Number(process.env.GRASSEYE_LOCAL_AI_POLL_INTERVAL_MS ?? 500),
    allowRecovery: process.env.GRASSEYE_LOCAL_AI_ALLOW_RECOVERY !== "0",
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === "ready" ? 0 : 1;
}

void main();