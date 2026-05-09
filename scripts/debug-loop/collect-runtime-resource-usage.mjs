import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_BASE_URL = "http://127.0.0.1:4173";
const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_LIMIT = 12;

function parsePositiveInteger(value, minimum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : null;
}

function applyResourceUsageFlag(options, flag, value) {
  if (flag === "--base-url" && value) {
    options.baseUrl = value;
    return;
  }

  if (flag === "--interval-ms" && value) {
    const parsed = parsePositiveInteger(value, 1);
    if (parsed !== null) {
      options.intervalMs = parsed;
    }
    return;
  }

  if (flag === "--limit" && value) {
    const parsed = parsePositiveInteger(value, 1);
    if (parsed !== null) {
      options.limit = parsed;
    }
    return;
  }

  if (flag === "--samples" && value) {
    const parsed = parsePositiveInteger(value, 0);
    if (parsed !== null) {
      options.samples = parsed;
    }
    return;
  }

  if (flag === "--output" && value) {
    options.output = path.resolve(process.cwd(), value);
  }
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    intervalMs: DEFAULT_INTERVAL_MS,
    limit: DEFAULT_LIMIT,
    samples: 0,
    output: path.resolve(process.cwd(), "tmp/runtime-resource-usage.ndjson"),
  };

  for (const rawArg of argv) {
    if (!rawArg.startsWith("--")) {
      continue;
    }
    const [flag, value = ""] = rawArg.split("=", 2);
    applyResourceUsageFlag(options, flag, value);
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSummary(snapshot) {
  const topInteresting = Array.isArray(snapshot.interestingProcesses)
    ? snapshot.interestingProcesses.slice(0, 3)
    : [];
  const parts = topInteresting.map((processSnapshot) => {
    const tags = Array.isArray(processSnapshot.tags) ? processSnapshot.tags.join(",") : "process";
    const rssMb = typeof processSnapshot.rssMb === "number" ? processSnapshot.rssMb.toFixed(1) : "?";
    const cpuPercent = typeof processSnapshot.cpuPercent === "number" ? processSnapshot.cpuPercent.toFixed(1) : "?";
    return `${tags}:${rssMb}MB/${cpuPercent}%`;
  });
  return parts.length > 0 ? parts.join(" | ") : "no interesting process matches";
}

async function fetchSnapshot(baseUrl, limit) {
  const response = await fetch(`${baseUrl}/api/runtime/resource-usage?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`resource usage endpoint returned ${response.status}`);
  }
  return response.json();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(path.dirname(options.output), { recursive: true });

  let stopped = false;
  const stop = () => {
    stopped = true;
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  process.stdout.write(
    `[resource-usage] sampling ${options.baseUrl}/api/runtime/resource-usage every ${options.intervalMs}ms -> ${options.output}\n`,
  );

  let sampleCount = 0;
  while (!stopped) {
    const capturedAt = new Date().toISOString();
    try {
      const snapshot = await fetchSnapshot(options.baseUrl, options.limit);
      await appendFile(options.output, `${JSON.stringify(snapshot)}\n`, "utf8");
      sampleCount += 1;
      process.stdout.write(`[resource-usage] ${capturedAt} sample=${sampleCount} ${buildSummary(snapshot)}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appendFile(options.output, `${JSON.stringify({ capturedAt, error: message })}\n`, "utf8");
      process.stdout.write(`[resource-usage] ${capturedAt} error=${message}\n`);
    }

    if (options.samples > 0 && sampleCount >= options.samples) {
      break;
    }

    await sleep(options.intervalMs);
  }

  process.stdout.write(`[resource-usage] stopped after ${sampleCount} samples\n`);
}

await main();