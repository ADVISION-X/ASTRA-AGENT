import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { RuntimeLogger, TraceContext } from "../runtime-logs/index.js";
import { RuntimeLogEventType } from "../runtime-logs/index.js";
import type { OnlineAiProviderConfig } from "./config.js";

const buildHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const buildGeminiConfigHash = (config: OnlineAiProviderConfig) => buildHash(JSON.stringify({
  providerCompany: config.providerCompany,
  providerKind: config.providerKind,
  modelName: config.modelName,
  endpoint: config.endpoint,
}));

export type GeminiGenerateInput = {
  config: OnlineAiProviderConfig;
  promptText: string;
  imagePaths: string[];
  timeoutMs: number;
  responseSchema?: Record<string, unknown>;
  runtimeLogger?: RuntimeLogger;
  traceContext?: TraceContext;
  missionId?: string;
  roundId?: string | null;
  abortSignal?: AbortSignal;
};

export type GeminiGenerateResult = {
  rawText: string;
  modelName: string;
  runtimeName: "gemini-api";
  durationMs: number;
  runtimeCallId: string;
};

function createAbortContext(timeoutMs: number, externalSignal?: AbortSignal) {
  if (externalSignal) {
    return { requestSignal: externalSignal, clear: () => undefined };
  }
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(`Online AI timed out after ${timeoutMs}ms.`), timeoutMs);
  return { requestSignal: controller.signal, clear: () => clearTimeout(handle) };
}

async function readImageParts(imagePaths: string[]) {
  return Promise.all(imagePaths.map(async (imagePath, index) => {
    const buffer = await readFile(imagePath);
    const lowerPath = imagePath.toLowerCase();
    return {
      part: {
        inlineData: {
          mimeType: lowerPath.endsWith(".svg")
            ? "image/svg+xml"
            : lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")
              ? "image/jpeg"
              : "image/png",
          data: buffer.toString("base64"),
        },
      },
      hashKey: `image${index}Hash`,
      hashValue: buildHash(buffer).slice(0, 16) + "…",
      bytesKey: `image${index}Bytes`,
      bytesValue: buffer.length,
    };
  }));
}

function emitGeminiRequestDebug(
  input: GeminiGenerateInput,
  imageParts: Awaited<ReturnType<typeof readImageParts>>,
  promptHash: string,
  configHash: string,
): void {
  input.runtimeLogger?.emit({
    eventType: RuntimeLogEventType.AI_REQUEST_DEBUG,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "ai-capability",
    traceId: input.traceContext?.traceId ?? input.missionId ?? "no-trace",
    ...(input.missionId ? { missionId: input.missionId } : {}),
    ...(input.roundId ? { roundId: input.roundId } : {}),
    hashes: {
      promptHash,
      modelConfigHash: configHash,
      imageCount: String(imageParts.length),
      ...Object.fromEntries(imageParts.map((img) => [img.hashKey, img.hashValue])),
    },
    preview: { promptPreview: input.promptText.slice(0, 200).replace(/\s+/g, " ").trim() },
    refs: { modelName: input.config.modelName, runtimeName: "gemini-api", imagePaths: input.imagePaths.join(";") },
    metrics: {
      promptLength: input.promptText.length,
      timeoutMs: input.timeoutMs,
      imageCount: imageParts.length,
      ...Object.fromEntries(imageParts.map((img) => [img.bytesKey, img.bytesValue])),
    },
  });
}

function buildGeminiRequestBody(
  input: GeminiGenerateInput,
  imageParts: Awaited<ReturnType<typeof readImageParts>>,
): Record<string, unknown> {
  return {
    contents: [{
      parts: [
        { text: input.promptText },
        ...imageParts.map((img) => img.part),
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      ...(input.responseSchema ? { responseSchema: input.responseSchema } : {}),
    },
  };
}

function resolveGeminiFailureMessage(text: string): string {
  try {
    return (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
  } catch {
    return text;
  }
}

function extractGeminiRawText(text: string, modelName: string): string {
  const data = JSON.parse(text) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!rawText.trim()) {
    throw new Error(`Gemini ${modelName} returned an empty response.`);
  }
  return rawText;
}

function emitGeminiRawResponseDebug(input: GeminiGenerateInput, rawText: string, durationMs: number): void {
  input.runtimeLogger?.emit({
    eventType: RuntimeLogEventType.AI_RAW_RESPONSE_DEBUG,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "ai-capability",
    traceId: input.traceContext?.traceId ?? input.missionId ?? "no-trace",
    ...(input.missionId ? { missionId: input.missionId } : {}),
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status: "success",
    hashes: { rawOutputHash: buildHash(rawText) },
    preview: { rawResponsePreview: rawText.slice(0, 220).replace(/\s+/g, " ").trim() },
    metrics: { durationMs, rawTextLength: rawText.length },
  });
}

export async function invokeGemini(input: GeminiGenerateInput): Promise<GeminiGenerateResult> {
  const startedAt = Date.now();
  const runtimeCallId = randomUUID();
  const imageParts = await readImageParts(input.imagePaths);
  const promptHash = buildHash(input.promptText);
  const configHash = buildGeminiConfigHash(input.config);
  emitGeminiRequestDebug(input, imageParts, promptHash, configHash);

  const url = `${input.config.endpoint}/models/${input.config.modelName}:generateContent?key=${encodeURIComponent(input.config.apiKey)}`;
  const ctx = createAbortContext(input.timeoutMs, input.abortSignal);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: ctx.requestSignal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildGeminiRequestBody(input, imageParts)),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}: ${resolveGeminiFailureMessage(text)}`);
    }
    const rawText = extractGeminiRawText(text, input.config.modelName);
    const durationMs = Date.now() - startedAt;
    emitGeminiRawResponseDebug(input, rawText, durationMs);
    return { rawText, modelName: input.config.modelName, runtimeName: "gemini-api", durationMs, runtimeCallId };
  } finally {
    ctx.clear();
  }
}
