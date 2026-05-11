import { createHash, randomUUID } from "node:crypto";

import type { LocalModelCallInput, LocalModelCallResult } from "./contract.js";
import { loadLocalAiConfig } from "./config.js";
import { invokeOllama } from "./ollama-client.js";
import { prepareModelSafeImage, type ModelSafeImageInput } from "./model-safe-image.js";
import { RuntimeLogEventType } from "../runtime-logs/index.js";

const buildHash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function callLocalModel(input: LocalModelCallInput): Promise<LocalModelCallResult> {
  const startedAt = Date.now();

  let config: Awaited<ReturnType<typeof loadLocalAiConfig>>;
  try {
    config = await loadLocalAiConfig();
  } catch (error) {
    return {
      status: "failed",
      failureReason: `Local AI config load failed: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!config.enabled) {
    return {
      status: "failed",
      failureReason: "Local AI is disabled by configuration.",
      durationMs: Date.now() - startedAt,
      modelName: config.modelName,
      runtimeName: config.runtimeName,
    };
  }

  const modelName = input.modelName ?? config.modelName;
  const timeoutMs = input.timeoutMs ?? config.timeoutMs;
  const logger = input.runtimeLogger;
  const trace = input.traceContext;
  const spanId = randomUUID();

  // ── Image normalization (fail closed — before AI_REQUEST_DEBUG) ───────────
  let preparedImages: ModelSafeImageInput[] = [];
  if (input.imagePaths && input.imagePaths.length > 0) {
    try {
      preparedImages = await Promise.all(input.imagePaths.map((p) => prepareModelSafeImage(p)));
    } catch (normError) {
      const durationMs = Date.now() - startedAt;
      const message = normError instanceof Error ? normError.message : String(normError);
      logger?.emit({
        eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
        level: "error",
        modeVisibility: ["DEBUG", "TRACE"],
        owner: "local-ai",
        traceId: trace?.traceId ?? input.missionId ?? "no-trace",
        spanId,
        ...(trace?.spanId ? { parentSpanId: trace.spanId } : {}),
        ...(input.missionId ? { missionId: input.missionId } : {}),
        ...(input.runId ? { runId: input.runId } : {}),
        ...(input.roundId ? { roundId: input.roundId } : {}),
        status: "failed",
        reason: "MODEL_IMAGE_NORMALIZATION_FAILED",
        actionableMessage: message,
        refs: { modelName, runtimeName: config.runtimeName, errorKind: "MODEL_IMAGE_NORMALIZATION_FAILED" },
        metrics: { durationMs },
      });
      return {
        status: "failed",
        failureReason: message,
        durationMs,
        modelName,
        runtimeName: config.runtimeName,
      };
    }
  }

  // ── AI_REQUEST_DEBUG ──────────────────────────────────────────────────────
  const promptHash = buildHash(input.promptText);

  // Build per-image dimension proof for the log event.
  const imageHashEntries: Record<string, string> = {};
  const imageMetricEntries: Record<string, number> = {};
  const imagePreviewParts: string[] = [];
  preparedImages.forEach((img, i) => {
    imageHashEntries[`image${i}OriginalHash`] = img.originalHash.slice(0, 16) + "…";
    imageHashEntries[`image${i}ModelInputHash`] = img.modelInputHash.slice(0, 16) + "…";
    imageMetricEntries[`image${i}OriginalWidth`] = img.originalWidth;
    imageMetricEntries[`image${i}OriginalHeight`] = img.originalHeight;
    imageMetricEntries[`image${i}ModelInputWidth`] = img.modelInputWidth;
    imageMetricEntries[`image${i}ModelInputHeight`] = img.modelInputHeight;
    imageMetricEntries[`image${i}OriginalBytes`] = img.originalBytes;
    imageMetricEntries[`image${i}ModelInputBytes`] = img.modelInputBytes;
    imagePreviewParts.push(
      `img[${i}] ${img.originalWidth}x${img.originalHeight}->${img.modelInputWidth}x${img.modelInputHeight} wasResized=${img.wasResized}`,
    );
  });

  logger?.emit({
    eventType: RuntimeLogEventType.AI_REQUEST_DEBUG,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "local-ai",
    traceId: trace?.traceId ?? input.missionId ?? "no-trace",
    spanId,
    ...(trace?.spanId ? { parentSpanId: trace.spanId } : {}),
    ...(input.missionId ? { missionId: input.missionId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.roundId ? { roundId: input.roundId } : {}),
    ...(input.capabilityCallId ? { capabilityCallId: input.capabilityCallId } : {}),
    hashes: {
      promptHash,
      ...(preparedImages.length > 0 ? { imageCount: String(preparedImages.length) } : {}),
      ...imageHashEntries,
    },
    preview: {
      promptPreview: input.promptText.slice(0, 200).replace(/\s+/g, " ").trim(),
      ...(imagePreviewParts.length > 0 ? { imageNormSummary: imagePreviewParts.join("; ") } : {}),
    },
    refs: {
      modelName,
      runtimeName: config.runtimeName,
      ...(input.imagePaths?.length ? { imagePaths: input.imagePaths.join(";") } : {}),
    },
    metrics: {
      promptLength: input.promptText.length,
      timeoutMs,
      ...imageMetricEntries,
    },
  });

  try {
    const { rawText, imageCount } = await invokeOllama({
      endpoint: config.endpoint,
      modelName,
      promptText: input.promptText,
      timeoutMs,
      ...(preparedImages.length > 0 ? { imageBase64s: preparedImages.map((img) => img.base64) } : {}),
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });

    const durationMs = Date.now() - startedAt;
    const rawOutputHash = buildHash(rawText);
    const preview = rawText.slice(0, 220).replace(/\s+/g, " ").trim();

    // ── AI_RAW_RESPONSE_DEBUG ───────────────────────────────────────────────
    logger?.emit({
      eventType: RuntimeLogEventType.AI_RAW_RESPONSE_DEBUG,
      level: "debug",
      modeVisibility: ["DEBUG", "TRACE"],
      owner: "local-ai",
      traceId: trace?.traceId ?? input.missionId ?? "no-trace",
      spanId,
      ...(input.missionId ? { missionId: input.missionId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.roundId ? { roundId: input.roundId } : {}),
      status: "success",
      hashes: { rawOutputHash },
      preview: { rawResponsePreview: preview },
      metrics: { durationMs, rawTextLength: rawText.length },
    });

    return {
      status: "success",
      rawText,
      rawOutputHash,
      modelName,
      runtimeName: config.runtimeName,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    // ── AI_ERROR_DEBUG ──────────────────────────────────────────────────────
    logger?.emit({
      eventType: RuntimeLogEventType.AI_ERROR_DEBUG,
      level: "error",
      modeVisibility: ["DEBUG", "TRACE"],
      owner: "local-ai",
      traceId: trace?.traceId ?? input.missionId ?? "no-trace",
      spanId,
      ...(input.missionId ? { missionId: input.missionId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.roundId ? { roundId: input.roundId } : {}),
      status: "failed",
      reason: "model_invocation_failed",
      actionableMessage: message,
      refs: { modelName, runtimeName: config.runtimeName },
      metrics: { durationMs },
    });

    return {
      status: "failed",
      failureReason: message,
      durationMs,
      modelName,
      runtimeName: config.runtimeName,
    };
  }
}
