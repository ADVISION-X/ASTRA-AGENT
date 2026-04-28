import { rm, stat } from "node:fs/promises";

import type { LocalAiRuntimeAdapter, LocalAiRuntimeAdapterHealth, TextInvocationInput, VisionInvocationInput } from "./local-ai-runtime-adapter.js";
import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";
import { fetchJsonWithTimeout, readImageAsBase64 } from "./runtime-adapter-utils.js";

type OllamaTagsResponse = {
  models?: Array<{ name?: string }>;
};

type OllamaGenerateResponse = {
  response?: string;
};

type PreparedVisionImage = {
  sourcePath: string;
  base64: string;
  sourceBytes: number;
  preparedBytes: number;
  optimized: boolean;
  preparedPath: string;
  tempDir?: string;
};

const MAX_VISION_IMAGE_BYTES = 1_000_000;
const truncatePreview = (value: string, maxLength = 220): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

export class OllamaRuntimeAdapter implements LocalAiRuntimeAdapter {
  readonly runtime = "ollama" as const;

  constructor(private readonly baseUrl = process.env.GRASSEYE_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434") {}

  async getHealth(): Promise<LocalAiRuntimeAdapterHealth> {
    try {
      const availableModels = await this.listAvailableModels();
      return {
        runtime: this.runtime,
        status: "ready",
        detail: `ollama reachable with ${availableModels.length} local models`,
        availableModels,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        runtime: this.runtime,
        status: message.includes("HTTP 404") ? "missing" : "unreachable",
        detail: message,
        availableModels: [],
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async listAvailableModels(): Promise<string[]> {
    const response = await fetchJsonWithTimeout(`${this.baseUrl}/api/tags`, { method: "GET", timeoutMs: 8_000 });
    const parsed = response as OllamaTagsResponse;
    return (parsed.models ?? [])
      .map((model) => model.name?.trim() ?? "")
      .filter((modelName) => modelName.length > 0);
  }

  async ensureModelAvailable(modelName: string): Promise<void> {
    const availableModels = await this.listAvailableModels();
    if (!availableModels.includes(modelName)) {
      throw new LocalAiRuntimeError(
        "model_missing",
        `Ollama model ${modelName} is not installed locally.`,
        JSON.stringify({ availableModels }),
      );
    }
  }

  async invokeVisionTask(input: VisionInvocationInput): Promise<string> {
    if (input.imagePaths.length === 0) {
      throw new LocalAiRuntimeError("missing_evidence", "Vision task requires at least one image evidence file.");
    }
    await this.ensureModelAvailable(input.modelName);
    const imageArtifacts = await Promise.all(input.imagePaths.map((imagePath) => this.prepareVisionImage(imagePath)));

    try {
      const originalTotalBytes = imageArtifacts.reduce((sum, artifact) => sum + artifact.sourceBytes, 0);
      const preparedTotalBytes = imageArtifacts.reduce((sum, artifact) => sum + artifact.preparedBytes, 0);
      const totalBase64Chars = imageArtifacts.reduce((sum, artifact) => sum + artifact.base64.length, 0);
      const optimizedImageCount = imageArtifacts.filter((artifact) => artifact.optimized).length;
      await input.debugHook?.({
        eventType: "local_ai_adapter_request_started",
        detail: `runtime=ollama; model=${input.modelName}; baseUrl=${this.baseUrl}; imageCount=${imageArtifacts.length}; optimizedImageCount=${optimizedImageCount}; originalTotalImageBytes=${originalTotalBytes}; preparedTotalImageBytes=${preparedTotalBytes}; totalBase64Chars=${totalBase64Chars}; imagePaths=${imageArtifacts.map((artifact) => artifact.sourcePath).join(",")}`,
      });
      return this.invokeGenerate({
        model: input.modelName,
        prompt: input.prompt,
        images: imageArtifacts.map((artifact) => artifact.base64),
        timeoutMs: input.timeoutMs,
        debugHook: input.debugHook,
      });
    } finally {
      await Promise.all(
        imageArtifacts
          .map((artifact) => artifact.tempDir)
          .filter((tempDir): tempDir is string => typeof tempDir === "string" && tempDir.length > 0)
          .map((tempDir) => rm(tempDir, { recursive: true, force: true })),
      );
    }
  }

  async invokeTextTask(input: TextInvocationInput): Promise<string> {
    await this.ensureModelAvailable(input.modelName);
    return this.invokeGenerate({
      model: input.modelName,
      prompt: input.prompt,
      timeoutMs: input.timeoutMs,
      debugHook: input.debugHook,
    });
  }

  async invokeOcrTask(): Promise<string> {
    throw new LocalAiRuntimeError("disabled_by_policy", "Ollama adapter does not provide OCR execution.");
  }

  private async invokeGenerate(input: {
    model: string;
    prompt: string;
    images?: string[];
    timeoutMs: number;
    debugHook?: VisionInvocationInput["debugHook"];
  }): Promise<string> {
    const startedAt = Date.now();
    const response = await fetchJsonWithTimeout(`${this.baseUrl}/api/generate`, {
      method: "POST",
      timeoutMs: input.timeoutMs,
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        stream: false,
        ...(input.images ? { images: input.images } : {}),
      }),
    });
    const parsed = response as OllamaGenerateResponse;
    if (!parsed.response || parsed.response.trim().length === 0) {
      throw new LocalAiRuntimeError("invalid_output", `Ollama ${input.model} returned an empty response.`);
    }

    await input.debugHook?.({
      eventType: "local_ai_adapter_response_received",
      detail: `runtime=ollama; model=${input.model}; responsePreview=${truncatePreview(parsed.response)}`,
      durationMs: Date.now() - startedAt,
    });

    return parsed.response;
  }

  private async prepareVisionImage(imagePath: string): Promise<PreparedVisionImage> {
    const sourceStat = await stat(imagePath);
    if (sourceStat.size > MAX_VISION_IMAGE_BYTES) {
      throw new LocalAiRuntimeError(
        "missing_evidence",
        `Vision input ${imagePath} exceeds ${MAX_VISION_IMAGE_BYTES} bytes; upstream must call Screenshot Ability Group prepare-ai-input before local AI execution.`,
      );
    }

    const base64 = await readImageAsBase64(imagePath);
    return {
      sourcePath: imagePath,
      preparedPath: imagePath,
      base64,
      sourceBytes: sourceStat.size,
      preparedBytes: sourceStat.size,
      optimized: false,
    };
  }
}