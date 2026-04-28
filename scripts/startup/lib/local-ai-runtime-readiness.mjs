import { spawn } from "node:child_process";

const DEFAULT_OLLAMA_BASE_URL = process.env.GRASSEYE_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

function sleep(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function fetchJsonWithTimeout(url, timeoutMs) {
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

async function probeOllamaRuntime(baseUrl) {
  try {
    const payload = await fetchJsonWithTimeout(`${baseUrl}/api/tags`, 5_000);
    const availableModels = Array.isArray(payload?.models)
      ? payload.models
          .map((entry) => entry?.name?.trim?.() ?? "")
          .filter((name) => name.length > 0)
      : [];
    return {
      ok: true,
      availableModels,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      availableModels: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function waitForOllamaRuntime({ baseUrl, timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastProbe = { ok: false, availableModels: [], error: "Ollama runtime not ready" };

  while (Date.now() < deadline) {
    lastProbe = await probeOllamaRuntime(baseUrl);
    if (lastProbe.ok) {
      return lastProbe;
    }
    await sleep(intervalMs);
  }

  return lastProbe;
}

function trySpawnDetached(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve(undefined);
    });
  });
}

async function openOllamaApp(logger) {
  logger("Ollama runtime unavailable; attempting to open the Ollama app.");
  await trySpawnDetached("open", ["-a", "Ollama"]);
}

async function startOllamaServe(logger) {
  logger("Ollama app did not recover the runtime; attempting detached 'ollama serve'.");
  await trySpawnDetached("ollama", ["serve"]);
}

export async function ensureLocalAiRuntimeReady({
  logger = () => {},
  baseUrl = DEFAULT_OLLAMA_BASE_URL,
  appWarmupMs = 8_000,
  readyTimeoutMs = 20_000,
  pollIntervalMs = 500,
} = {}) {
  const initialProbe = await probeOllamaRuntime(baseUrl);
  if (initialProbe.ok) {
    logger(`Local AI runtime already reachable with ${initialProbe.availableModels.length} models.`);
    return {
      started: false,
      availableModels: initialProbe.availableModels,
    };
  }

  const failures = [initialProbe.error].filter(Boolean);

  try {
    await openOllamaApp(logger);
    await sleep(appWarmupMs);
    const appProbe = await waitForOllamaRuntime({
      baseUrl,
      timeoutMs: readyTimeoutMs,
      intervalMs: pollIntervalMs,
    });
    if (appProbe.ok) {
      logger(`Local AI runtime recovered via Ollama app with ${appProbe.availableModels.length} models.`);
      return {
        started: true,
        availableModels: appProbe.availableModels,
      };
    }
    failures.push(appProbe.error);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  try {
    await startOllamaServe(logger);
    const serveProbe = await waitForOllamaRuntime({
      baseUrl,
      timeoutMs: readyTimeoutMs,
      intervalMs: pollIntervalMs,
    });
    if (serveProbe.ok) {
      logger(`Local AI runtime recovered via detached ollama serve with ${serveProbe.availableModels.length} models.`);
      return {
        started: true,
        availableModels: serveProbe.availableModels,
      };
    }
    failures.push(serveProbe.error);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(`Local AI runtime is not ready at ${baseUrl}: ${failures.filter(Boolean).join(" | ")}`);
}