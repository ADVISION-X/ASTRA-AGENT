// Internal Ollama HTTP client. Not exported in index.ts.
import { readFile, stat } from "node:fs/promises";

const MAX_VISION_IMAGE_BYTES = 1_000_000;

type OllamaTagsResponse = { models?: Array<{ name?: string }> };
type OllamaGenerateResponse = { response?: string };

function createAbortContext(timeoutMs: number, externalSignal?: AbortSignal) {
  if (externalSignal) {
    return { requestSignal: externalSignal, clear: () => undefined };
  }
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(`Local AI timed out after ${timeoutMs}ms.`), timeoutMs);
  return { requestSignal: controller.signal, clear: () => clearTimeout(handle) };
}

async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number }): Promise<unknown> {
  const { timeoutMs = 10_000, signal: _externalSignal, ...rest } = init;
  const ctx = createAbortContext(timeoutMs, _externalSignal as AbortSignal | undefined);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: ctx.requestSignal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...((rest.headers as Record<string, string>) ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Local AI HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Local AI request aborted or timed out: ${error.message}`);
    }
    throw error;
  } finally {
    ctx.clear();
  }
}

export async function listAvailableModels(endpoint: string): Promise<string[]> {
  const response = await fetchJson(`${endpoint}/api/tags`, { method: "GET", timeoutMs: 8_000 }) as OllamaTagsResponse;
  return (response.models ?? []).map((m) => m.name?.trim() ?? "").filter(Boolean);
}

async function readImageAsBase64(filePath: string): Promise<{ base64: string; bytes: number }> {
  const fileStat = await stat(filePath);
  if (fileStat.size > MAX_VISION_IMAGE_BYTES) {
    throw new Error(
      `Vision input ${filePath} exceeds ${MAX_VISION_IMAGE_BYTES} bytes; Screenshot Ability Group must prepare-ai-input before local AI execution.`,
    );
  }
  const buffer = await readFile(filePath);
  return { base64: buffer.toString("base64"), bytes: fileStat.size };
}

export async function invokeOllama(input: {
  endpoint: string;
  modelName: string;
  promptText: string;
  imagePaths?: string[];
  timeoutMs: number;
  abortSignal?: AbortSignal;
}): Promise<{ rawText: string; imageCount: number }> {
  let images: string[] | undefined;
  if (input.imagePaths && input.imagePaths.length > 0) {
    const prepared = await Promise.all(input.imagePaths.map((p) => readImageAsBase64(p)));
    images = prepared.map((p) => p.base64);
  }

  const response = await fetchJson(`${input.endpoint}/api/generate`, {
    method: "POST",
    timeoutMs: input.timeoutMs,
    ...(input.abortSignal ? { signal: input.abortSignal } : {}),
    body: JSON.stringify({
      model: input.modelName,
      prompt: input.promptText,
      stream: false,
      ...(images ? { images } : {}),
    }),
  }) as OllamaGenerateResponse;

  if (!response.response || response.response.trim().length === 0) {
    throw new Error(`Ollama ${input.modelName} returned an empty response.`);
  }

  return { rawText: response.response, imageCount: images?.length ?? 0 };
}
