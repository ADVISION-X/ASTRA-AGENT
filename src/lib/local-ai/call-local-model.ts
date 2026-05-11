import { createHash, randomUUID } from "node:crypto";

import type { LocalModelCallInput, LocalModelCallResult } from "./contract.js";
import { loadLocalAiConfig } from "./config.js";
import { invokeOllama } from "./ollama-client.js";
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

  // ── AI_REQUEST_DEBUG ──────────────────────────────────────────────────────
  const promptHash = buildHash(input.promptText);
  logger?.emit({
    eventType: RuntimeLogEventType.AI_REQUEST_DEBUG,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "local-ai",
    traceId: trace?.traceId ?? randomUUID(),
    spanId,
    ...(trace?.spanId ? { parentSpanId: trace.spanId } : {}),
    ...(input.missionId ? { missionId: input.missionId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.roundId ? { roundId: input.roundId } : {}),
    ...(input.capabilityCallId ? { capabilityCallId: input.capabilityCallId } : {}),
    hashes: {
      promptHash,
      ...(input.imagePaths?.length ? { imageCount: String(input.imagePaths.length) } : {}),
    },
    preview: {
      promptPreview: input.promptText.slice(0, 200).replace(/\s+/g, " ").trim(),
    },
    refs: {
      modelName,
      runtimeName: config.runtimeName,
      ...(input.imagePaths?.length ? { imagePaths: input.imagePaths.join(";") } : {}),
    },
    metrics: {
      promptLength: input.promptText.length,
      timeoutMs,
    },
  });

  try {
    const { rawText, imageCount } = await invokeOllama({
      endpoint: config.endpoint,
      modelName,
      promptText: input.promptText,
      timeoutMs,
      ...(input.imagePaths ? { imagePaths: input.imagePaths } : {}),
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
      traceId: trace?.traceId ?? randomUUID(),
      spanId,
      ...(input.missionId ? { missionId: input.missionId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.roundId ? { roundId: input.roundId } : {}),
      status: "success",
      hashes: { rawOutputHash },
      preview: { rawResponsePreview: preview },
      metrics: { durationMs, rawTextLength: rawText.length },
    });

    // Bridge: legacy debugHook (deprecated path)
    await input.debugHook?.({
      eventType: "local_ai_call_completed",
      detail: `model=${modelName}; runtime=${config.runtimeName}; imageCount=${imageCount}; durationMs=${durationMs}`,
      modelName,
      runtimeName: config.runtimeName,
      durationMs,
      rawResponseText: rawText,
      rawResponsePreview: preview,
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
      traceId: trace?.traceId ?? randomUUID(),
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
