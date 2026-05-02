import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";

import type { LocalAiRuntimeAdapter, LocalAiRuntimeAdapterHealth, TextInvocationInput, VisionInvocationInput } from "./local-ai-runtime-adapter.js";
import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";
import {
  buildOllamaRuntimeHealth,
  ensureOllamaModelAvailable,
  invokeOllamaGenerate,
  listOllamaAvailableModels,
} from "./ollama-runtime-support.js";
import { prepareOllamaVisionImage } from "./ollama-vision-image.js";

export class OllamaRuntimeAdapter implements LocalAiRuntimeAdapter {
  readonly runtime = "ollama" as const;

  constructor(private readonly baseUrl = process.env.GRASSEYE_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434") {}

  async getHealth(): Promise<LocalAiRuntimeAdapterHealth> {
    return buildOllamaRuntimeHealth(this.runtime, this.baseUrl);
  }

  async listAvailableModels(): Promise<string[]> {
    return listOllamaAvailableModels(this.baseUrl);
  }

  async ensureModelAvailable(modelName: string): Promise<void> {
    await ensureOllamaModelAvailable(this.baseUrl, modelName);
  }

  async invokeVisionTask(input: VisionInvocationInput): Promise<string> {
    if (input.imagePaths.length === 0) {
      throw new LocalAiRuntimeError("missing_evidence", "Vision task requires at least one image evidence file.");
    }
    await this.ensureModelAvailable(input.modelName);
    const imageArtifacts = await Promise.all(input.imagePaths.map((imagePath) => prepareOllamaVisionImage(imagePath)));
    const originalTotalBytes = imageArtifacts.reduce((sum, artifact) => sum + artifact.sourceBytes, 0);
    const preparedTotalBytes = imageArtifacts.reduce((sum, artifact) => sum + artifact.preparedBytes, 0);
    const totalBase64Chars = imageArtifacts.reduce((sum, artifact) => sum + artifact.base64.length, 0);
    const optimizedImageCount = imageArtifacts.filter((artifact) => artifact.optimized).length;
    await input.debugHook?.({
      eventType: "local_ai_adapter_request_started",
      detail: `runtime=ollama; model=${input.modelName}; baseUrl=${this.baseUrl}; imageCount=${imageArtifacts.length}; optimizedImageCount=${optimizedImageCount}; originalTotalImageBytes=${originalTotalBytes}; preparedTotalImageBytes=${preparedTotalBytes}; totalBase64Chars=${totalBase64Chars}; imagePaths=${imageArtifacts.map((artifact) => artifact.sourcePath).join(",")}`,
      modelName: input.modelName,
      runtime: this.runtime,
      imageInputs: imageArtifacts.map((artifact) => ({
        filePath: artifact.sourcePath,
        hash: artifact.sourceHash,
        bytes: artifact.sourceBytes,
        ...(typeof artifact.width === "number" ? { width: artifact.width } : {}),
        ...(typeof artifact.height === "number" ? { height: artifact.height } : {}),
      })),
    });
    return invokeOllamaGenerate({
      baseUrl: this.baseUrl,
      runtime: this.runtime,
      model: input.modelName,
      prompt: input.prompt,
      images: imageArtifacts.map((artifact) => artifact.base64),
      timeoutMs: input.timeoutMs,
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.debugHook ? { debugHook: input.debugHook } : {}),
    });
  }

  async invokeTextTask(input: TextInvocationInput): Promise<string> {
    await this.ensureModelAvailable(input.modelName);
    return invokeOllamaGenerate({
      baseUrl: this.baseUrl,
      runtime: this.runtime,
      model: input.modelName,
      prompt: input.prompt,
      timeoutMs: input.timeoutMs,
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.debugHook ? { debugHook: input.debugHook } : {}),
    });
  }

  async invokeOcrTask(): Promise<string> {
    throw new LocalAiRuntimeError("disabled_by_policy", "Ollama adapter does not provide OCR execution.");
  }
}