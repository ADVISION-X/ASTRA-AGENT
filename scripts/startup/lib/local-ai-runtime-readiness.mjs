import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_OLLAMA_BASE_URL = process.env.GRASSEYE_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const probeScriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "local-ai-runtime-readiness-probe.ts");

const parseProbeOutput = (stdout, stderr) => {
  const jsonLine = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!jsonLine) {
    throw new Error(stderr.trim() || "Local AI startup readiness probe produced no JSON output.");
  }
  return JSON.parse(jsonLine);
};

async function runReadinessProbe(env, logger) {
  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn("node", ["--import", "tsx", probeScriptPath], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      const text = Buffer.from(chunk).toString("utf8").trim();
      if (text.length > 0) {
        logger(text);
      }
      stderrChunks.push(Buffer.from(chunk));
    });
    child.once("error", reject);
    child.once("close", () => {
      try {
        resolve(parseProbeOutput(Buffer.concat(stdoutChunks).toString("utf8"), Buffer.concat(stderrChunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function ensureLocalAiRuntimeReady({
  logger = () => {},
  baseUrl = DEFAULT_OLLAMA_BASE_URL,
  appWarmupMs = 8_000,
  readyTimeoutMs = 20_000,
  pollIntervalMs = 500,
  allowRecovery = true,
} = {}) {
  return runReadinessProbe({
    GRASSEYE_OLLAMA_BASE_URL: baseUrl,
    GRASSEYE_LOCAL_AI_APP_WARMUP_MS: String(appWarmupMs),
    GRASSEYE_LOCAL_AI_READY_TIMEOUT_MS: String(readyTimeoutMs),
    GRASSEYE_LOCAL_AI_POLL_INTERVAL_MS: String(pollIntervalMs),
    GRASSEYE_LOCAL_AI_ALLOW_RECOVERY: allowRecovery ? "1" : "0",
  }, logger);
}