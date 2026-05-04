import { createHash, randomUUID } from "node:crypto";

import type { AiRuntimeExecutionOutput } from "../contract.js";
import { AiRuntimeExecutionOutputSchema } from "../schema.js";

export function buildExternalProviderFailureOutput(input: {
  implementationStatus: string;
  modelName: string;
  failureReason: string;
}): AiRuntimeExecutionOutput {
  return AiRuntimeExecutionOutputSchema.parse({
    modelProvider: "paid",
    modelName: input.modelName,
    modelRole: "future",
    runtime: "openai-compatible",
    implementationStatus: input.implementationStatus,
    createdAt: null,
    confidence: null,
    costEstimate: null,
    output: null,
    rawOutputRef: null,
    rawOutputHash: null,
    runtimeCallId: null,
    timeoutMs: null,
    attemptIndex: 0,
    retryCount: 0,
    circuitBreakerState: "not_applicable",
    gatewayDurationMs: null,
    modelHealthBefore: input.failureReason,
    modelHealthAfter: input.failureReason,
  });
}

function buildRawOutputProof(taskType: string, rawOutput: string) {
  const outputHash = createHash("sha256").update(rawOutput).digest("hex");
  return {
    rawOutputRef: `ai-runtime://openai-compatible/${taskType}/${randomUUID()}`,
    rawOutputHash: `sha256:${outputHash}`,
  };
}

function resolveConfidence(output: unknown): number | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const candidate = output as { confidence?: unknown; score?: unknown };
  if (typeof candidate.confidence === "number") {
    return candidate.confidence;
  }
  if (typeof candidate.score === "number") {
    return candidate.score;
  }
  return null;
}

export function buildExternalProviderSuccessOutput(input: {
  taskType: string;
  rawText: string;
  modelName: string;
  responseId: string | null;
  normalizedOutput: unknown;
  createdAt: string;
  gatewayDurationMs: number;
}): AiRuntimeExecutionOutput {
  const proof = buildRawOutputProof(input.taskType, input.rawText);
  return AiRuntimeExecutionOutputSchema.parse({
    modelProvider: "paid",
    modelName: input.modelName,
    modelRole: "future",
    runtime: "openai-compatible",
    implementationStatus: "external_runtime",
    createdAt: input.createdAt,
    confidence: resolveConfidence(input.normalizedOutput),
    costEstimate: null,
    output: input.normalizedOutput,
    rawOutputRef: proof.rawOutputRef,
    rawOutputHash: proof.rawOutputHash,
    runtimeCallId: input.responseId ?? randomUUID(),
    timeoutMs: null,
    attemptIndex: 0,
    retryCount: 0,
    circuitBreakerState: "not_applicable",
    gatewayDurationMs: input.gatewayDurationMs,
    modelHealthBefore: "configured",
    modelHealthAfter: "ok",
  });
}

export function parseExternalProviderResponseText(payload: unknown): { responseId: string | null; model: string | null; text: string | null } {
  if (!payload || typeof payload !== "object") {
    return { responseId: null, model: null, text: null };
  }

  const typed = payload as {
    id?: unknown;
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const firstChoice = Array.isArray(typed.choices) ? typed.choices[0] : null;
  return {
    responseId: typeof typed.id === "string" ? typed.id : null,
    model: typeof typed.model === "string" ? typed.model : null,
    text: typeof firstChoice?.message?.content === "string" ? firstChoice.message.content : null,
  };
}