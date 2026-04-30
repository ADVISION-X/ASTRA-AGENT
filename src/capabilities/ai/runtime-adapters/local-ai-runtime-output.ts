import type { AiRuntimeExecutionOutput } from "../contract.js";
import { AiRuntimeExecutionOutputSchema } from "../schema.js";

type LocalAiCircuitBreakerState = "closed" | "open" | "half_open" | "not_applicable";

function resolveFallbackModelRole(taskType: string): "vision" | "ocr" | "multi-role" {
  if (taskType === "ocr_cleanup") {
    return "ocr";
  }
  if (taskType === "comment_signal_summary" || taskType === "product_signal_summary") {
    return "multi-role";
  }
  return "vision";
}

function buildLocalAiFailureOutput(input: {
  taskType: string;
  implementationStatus: string;
  message: string;
  rawOutputRef: string;
  rawOutputHash: string;
  runtimeCallId: string | null;
  timeoutMs: number;
  circuitBreakerState: LocalAiCircuitBreakerState;
  gatewayDurationMs: number | null;
  modelHealthBefore: string;
  modelHealthAfter: string;
}): AiRuntimeExecutionOutput {
  return AiRuntimeExecutionOutputSchema.parse({
    modelProvider: "local",
    modelName: "unavailable",
    modelRole: resolveFallbackModelRole(input.taskType),
    runtime: "local-adapter",
    implementationStatus: input.implementationStatus,
    createdAt: null,
    confidence: null,
    costEstimate: 0,
    output: { message: input.message },
    rawOutputRef: input.rawOutputRef,
    rawOutputHash: input.rawOutputHash,
    runtimeCallId: input.runtimeCallId,
    timeoutMs: input.timeoutMs,
    attemptIndex: 0,
    retryCount: 0,
    circuitBreakerState: input.circuitBreakerState,
    gatewayDurationMs: input.gatewayDurationMs,
    modelHealthBefore: input.modelHealthBefore,
    modelHealthAfter: input.modelHealthAfter,
  });
}

function buildLocalAiSuccessOutput(input: {
  modelName: string;
  modelRole: string;
  runtime: string;
  implementationStatus: string;
  createdAt: string | null;
  confidence: number | null;
  output: unknown;
  rawOutputRef: string;
  rawOutputHash: string;
  runtimeCallId: string | null;
  timeoutMs: number;
  circuitBreakerState: LocalAiCircuitBreakerState;
  gatewayDurationMs: number;
  modelHealthBefore: string;
  modelHealthAfter: string;
}): AiRuntimeExecutionOutput {
  return AiRuntimeExecutionOutputSchema.parse({
    modelProvider: "local",
    modelName: input.modelName,
    modelRole: input.modelRole,
    runtime: input.runtime,
    implementationStatus: input.implementationStatus,
    createdAt: input.createdAt,
    confidence: input.confidence,
    costEstimate: 0,
    output: input.output,
    rawOutputRef: input.rawOutputRef,
    rawOutputHash: input.rawOutputHash,
    runtimeCallId: input.runtimeCallId,
    timeoutMs: input.timeoutMs,
    attemptIndex: 0,
    retryCount: 0,
    circuitBreakerState: input.circuitBreakerState,
    gatewayDurationMs: input.gatewayDurationMs,
    modelHealthBefore: input.modelHealthBefore,
    modelHealthAfter: input.modelHealthAfter,
  });
}

export {
  buildLocalAiFailureOutput,
  buildLocalAiSuccessOutput,
};

export type { LocalAiCircuitBreakerState };