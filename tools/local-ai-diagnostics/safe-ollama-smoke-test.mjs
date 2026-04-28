import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://127.0.0.1:11434";
const TEXT_MODEL = "qwen2.5:3b";
const VISION_MODEL = "qwen2.5vl:3b";

const RESULTS_DIR = path.join(__dirname, "results");
const TEST_ASSETS_DIR = path.join(__dirname, "test-assets");
const RESULT_PATH = path.join(RESULTS_DIR, "ollama-smoke-result.json");
const DAEMON_LOG_PATH = path.join(RESULTS_DIR, "ollama-daemon.log");
const VISION_ASSET_PATH = path.join(TEST_ASSETS_DIR, "local-vision-smoke.png");

const result = {
  timestamp: new Date().toISOString(),
  ollama: {
    daemonReachableBeforeStart: false,
    daemonReachableAfterStart: false,
    tags: [],
  },
  models: {
    textModel: TEXT_MODEL,
    textModelPresent: false,
    visionModel: VISION_MODEL,
    visionModelPresent: false,
  },
  textSmoke: {
    status: "SKIPPED",
    durationMs: null,
    responsePreview: null,
    error: null,
  },
  visionSmoke: {
    status: "SKIPPED",
    durationMs: null,
    responsePreview: null,
    error: null,
  },
  verdict: "BLOCKED",
  nextRecommendedStep: "Inspect the smoke-test logs before any further local AI debugging.",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPreview(value, maxLength = 240) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchJsonWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const rawText = await response.text();
    let parsed = null;
    try {
      parsed = rawText.length > 0 ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      parsed,
      rawText,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function runCommand(command, args, timeoutMs, outputStream = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    if (outputStream) {
      child.stdout.pipe(outputStream, { end: false });
      child.stderr.pipe(outputStream, { end: false });
    }

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

async function checkDaemon() {
  try {
    const response = await fetchJsonWithTimeout(`${BASE_URL}/api/tags`, { method: "GET" }, 5_000);
    if (!response.ok || !response.parsed || !Array.isArray(response.parsed.models)) {
      return {
        reachable: false,
        tags: [],
        error: response.rawText || `HTTP ${response.status}`,
      };
    }

    return {
      reachable: true,
      tags: response.parsed.models
        .map((model) => model?.name)
        .filter((name) => typeof name === "string" && name.length > 0),
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      tags: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function tryOpenOllamaApp() {
  try {
    await runCommand("open", ["-a", "Ollama"], 5_000);
    await sleep(8_000);
    return { attempted: true, error: null };
  } catch (error) {
    return { attempted: true, error: error instanceof Error ? error.message : String(error) };
  }
}

async function trySpawnOllamaServe() {
  const logStream = createWriteStream(DAEMON_LOG_PATH, { flags: "a" });
  logStream.write(`\n[${new Date().toISOString()}] spawning ollama serve\n`);

  try {
    const child = spawn("ollama", ["serve"], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(logStream, { end: false });
    child.stderr.pipe(logStream, { end: false });
    child.unref();
    await sleep(8_000);
    logStream.write(`[${new Date().toISOString()}] spawned ollama serve pid=${child.pid ?? "unknown"}\n`);
    return { attempted: true, error: null };
  } catch (error) {
    logStream.write(`[${new Date().toISOString()}] failed to spawn ollama serve: ${error instanceof Error ? error.message : String(error)}\n`);
    return { attempted: true, error: error instanceof Error ? error.message : String(error) };
  } finally {
    logStream.end();
  }
}

function setCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = setCrcTable();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

const FONT = {
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function fillRect(pixels, width, x, y, rectWidth, rectHeight, color) {
  for (let row = y; row < y + rectHeight; row += 1) {
    for (let column = x; column < x + rectWidth; column += 1) {
      const offset = (row * width + column) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
}

function drawText(pixels, width, height, text, startX, startY, scale, color) {
  let cursorX = startX;
  for (const character of text) {
    const glyph = FONT[character] ?? FONT[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") {
          continue;
        }
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const x = cursorX + column * scale + dx;
            const y = startY + row * scale + dy;
            if (x < 0 || x >= width || y < 0 || y >= height) {
              continue;
            }
            const offset = (y * width + x) * 4;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = color[3];
          }
        }
      }
    }
    cursorX += (glyph[0].length + 1) * scale;
  }
}

async function generateVisionAsset() {
  const width = 512;
  const height = 512;
  const pixels = Buffer.alloc(width * height * 4, 255);
  fillRect(pixels, width, 120, 120, 272, 200, [220, 32, 32, 255]);
  drawText(pixels, width, height, "RED BOX", 110, 360, 8, [0, 0, 0, 255]);

  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width * 4;
    rows.push(Buffer.concat([Buffer.from([0]), pixels.subarray(rowStart, rowStart + width * 4)]));
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const pngBuffer = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  await writeFile(VISION_ASSET_PATH, pngBuffer);
  return { width, height, path: VISION_ASSET_PATH };
}

async function runTextSmoke() {
  const startedAt = Date.now();
  try {
    const response = await fetchJsonWithTimeout(
      `${BASE_URL}/api/generate`,
      {
        method: "POST",
        body: JSON.stringify({
          model: TEXT_MODEL,
          prompt: "Reply with exactly OK.",
          stream: false,
          keep_alive: "30s",
          options: {
            num_predict: 8,
            num_ctx: 512,
            temperature: 0,
          },
        }),
      },
      45_000,
    );

    const durationMs = Date.now() - startedAt;
    const preview = toPreview(response.parsed?.response ?? response.rawText);
    result.textSmoke.durationMs = durationMs;
    result.textSmoke.responsePreview = preview;

    if (!response.ok) {
      result.textSmoke.status = "FAIL";
      result.textSmoke.error = response.rawText || `HTTP ${response.status}`;
      return false;
    }

    if (typeof response.parsed?.response !== "string" || !response.parsed.response.toUpperCase().includes("OK")) {
      result.textSmoke.status = "FAIL";
      result.textSmoke.error = "TEXT_SMOKE_FAIL: response did not contain OK";
      return false;
    }

    result.textSmoke.status = "PASS";
    return true;
  } catch (error) {
    result.textSmoke.durationMs = Date.now() - startedAt;
    result.textSmoke.error = error instanceof Error ? error.message : String(error);
    result.textSmoke.status = isAbortError(error) ? "TIMEOUT" : "FAIL";
    return false;
  }
}

async function runVisionSmoke() {
  const asset = await generateVisionAsset();
  const imageBase64 = (await readFile(asset.path)).toString("base64");
  const startedAt = Date.now();

  try {
    const response = await fetchJsonWithTimeout(
      `${BASE_URL}/api/generate`,
      {
        method: "POST",
        body: JSON.stringify({
          model: VISION_MODEL,
          prompt: "Look at the image. Return JSON only: {\"ok\": true, \"label\": \"...\"}. The label should describe the main object in 5 words or less.",
          images: [imageBase64],
          stream: false,
          keep_alive: "30s",
          options: {
            num_predict: 32,
            num_ctx: 1024,
            temperature: 0,
          },
        }),
      },
      90_000,
    );

    const durationMs = Date.now() - startedAt;
    const preview = toPreview(response.parsed?.response ?? response.rawText);
    result.visionSmoke.durationMs = durationMs;
    result.visionSmoke.responsePreview = preview;

    if (!response.ok) {
      result.visionSmoke.status = "FAIL";
      result.visionSmoke.error = response.rawText || `HTTP ${response.status}`;
      return false;
    }

    const normalized = String(response.parsed?.response ?? "").toLowerCase();
    if (!normalized.includes("red box") && !normalized.includes("rectangle") && !normalized.includes("box")) {
      result.visionSmoke.status = "FAIL";
      result.visionSmoke.error = "VISION_SMOKE_FAIL: response did not describe the red box image";
      return false;
    }

    result.visionSmoke.status = "PASS";
    return true;
  } catch (error) {
    result.visionSmoke.durationMs = Date.now() - startedAt;
    result.visionSmoke.error = error instanceof Error ? error.message : String(error);
    result.visionSmoke.status = isAbortError(error) ? "TIMEOUT" : "FAIL";
    return false;
  }
}

async function writeResult() {
  await mkdir(RESULTS_DIR, { recursive: true });
  result.timestamp = new Date().toISOString();
  await writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function finalizeVerdict() {
  if (!result.ollama.daemonReachableAfterStart) {
    result.verdict = "OLLAMA_DAEMON_UNAVAILABLE";
    result.nextRecommendedStep = "Resolve the Ollama daemon startup path before any further local AI debugging.";
    return;
  }

  if (!result.models.textModelPresent) {
    result.verdict = "TEXT_MODEL_FAILED";
    result.nextRecommendedStep = "Restore the qwen2.5:3b Ollama model before retrying text smoke tests.";
    return;
  }

  if (result.textSmoke.status !== "PASS") {
    result.verdict = "TEXT_MODEL_FAILED";
    result.nextRecommendedStep = "Keep the scope on Ollama text runtime readiness and do not enter the vision path yet.";
    return;
  }

  if (!result.models.visionModelPresent) {
    result.verdict = "VISION_MODEL_FAILED";
    result.nextRecommendedStep = "Restore the qwen2.5vl:3b Ollama model before retrying the vision smoke test.";
    return;
  }

  if (result.visionSmoke.status !== "PASS") {
    result.verdict = "VISION_MODEL_FAILED";
    result.nextRecommendedStep = "Keep the next round on vision-model parameters only, with the same 512px single-image constraint.";
    return;
  }

  result.verdict = "LOCAL_AI_RUNTIME_OK";
  result.nextRecommendedStep = "The next round may use one real 512px browser-region screenshot only.";
}

async function main() {
  await mkdir(RESULTS_DIR, { recursive: true });
  await mkdir(TEST_ASSETS_DIR, { recursive: true });
  await rm(DAEMON_LOG_PATH, { force: true });

  const before = await checkDaemon();
  result.ollama.daemonReachableBeforeStart = before.reachable;
  if (before.reachable) {
    result.ollama.daemonReachableAfterStart = true;
    result.ollama.tags = before.tags;
  } else {
    const openAttempt = await tryOpenOllamaApp();
    const afterOpen = await checkDaemon();
    if (afterOpen.reachable) {
      result.ollama.daemonReachableAfterStart = true;
      result.ollama.tags = afterOpen.tags;
    } else {
      const serveAttempt = await trySpawnOllamaServe();
      const afterServe = await checkDaemon();
      result.ollama.daemonReachableAfterStart = afterServe.reachable;
      result.ollama.tags = afterServe.tags;
      if (!afterServe.reachable) {
        result.textSmoke.error = [
          "OLLAMA_DAEMON_START_FAILED",
          before.error,
          openAttempt.error,
          serveAttempt.error,
          afterServe.error,
        ].filter(Boolean).join(" | ");
        finalizeVerdict();
        await writeResult();
        return;
      }
    }
  }

  result.models.textModelPresent = result.ollama.tags.includes(TEXT_MODEL);
  result.models.visionModelPresent = result.ollama.tags.includes(VISION_MODEL);

  if (!result.models.textModelPresent) {
    result.textSmoke.error = "TEXT_MODEL_MISSING";
    finalizeVerdict();
    await writeResult();
    return;
  }

  const textOk = await runTextSmoke();
  if (!textOk) {
    finalizeVerdict();
    await writeResult();
    return;
  }

  if (!result.models.visionModelPresent) {
    result.visionSmoke.error = "VISION_MODEL_MISSING";
    finalizeVerdict();
    await writeResult();
    return;
  }

  try {
    await runVisionSmoke();
  } catch (error) {
    result.visionSmoke.status = "FAIL";
    result.visionSmoke.error = error instanceof Error ? error.message : String(error);
  }

  finalizeVerdict();
  await writeResult();
}

main().catch(async (error) => {
  result.textSmoke.error = result.textSmoke.error ?? (error instanceof Error ? error.message : String(error));
  result.verdict = "BLOCKED";
  result.nextRecommendedStep = "Inspect the diagnostic script failure before retrying any local AI request.";
  await writeResult();
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});