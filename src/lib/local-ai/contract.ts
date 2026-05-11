// Local AI Contract: types only. No implementation.
// This module is the internal model-call boundary used by the AI Ability Group.

import type { RuntimeLogger } from "../runtime-logs/index.js";
import type { TraceContext } from "../runtime-logs/index.js";

export type {
  RuntimeLogger,
  TraceContext,
};

/**
 * @deprecated Use runtimeLogger + RuntimeLogEventType.AI_REQUEST_DEBUG / AI_RAW_RESPONSE_DEBUG instead.
 * Retained only as an opt-in bridge for legacy callers; must not be used as the main debug path.
 */
export type LocalAiDebugEvent = {
  eventType: string;
  /** @deprecated Use structured RuntimeLogEvent fields instead. */
  detail: string;
  modelName?: string;
  runtimeName?: string;
  durationMs?: number;
  rawResponseText?: string;
  rawResponsePreview?: string;
  imageInputs?: Array<{
    filePath: string;
    hash?: string;
    bytes?: number;
    width?: number;
    height?: number;
  }>;
};

/**
 * @deprecated Use runtimeLogger injected via LocalModelCallInput instead.
 * The debugHook field is retained for bridge compatibility only.
 */
export type LocalAiDebugHook = (event: LocalAiDebugEvent) => void | Promise<void>;

export type LocalAiConfig = {
  runtimeName: "ollama";
  endpoint: string;
  modelName: string;
  timeoutMs: number;
  enabled: boolean;
};

export type LocalModelCallInput = {
  requestId: string;
  missionId?: string | null;
  runId?: string | null;
  roundId?: string | null;
  capabilityCallId?: string | null;
  promptText: string;
  imagePaths?: string[];
  modelName?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  /** Preferred: inject a RuntimeLogger to receive AI_REQUEST_DEBUG / AI_RAW_RESPONSE_DEBUG events. */
  runtimeLogger?: RuntimeLogger;
  /** Preferred: inject trace context so emitted events carry traceId/spanId. */
  traceContext?: TraceContext;
  /**
   * @deprecated Bridge-only. Prefer runtimeLogger.
   * Called after model call completes for legacy callers that have not migrated.
   */
  debugHook?: LocalAiDebugHook;
  metadata?: Record<string, unknown>;
};

export type LocalModelCallResult =
  | {
      status: "success";
      rawText: string;
      rawOutputHash: string;
      modelName: string;
      runtimeName: string;
      durationMs: number;
    }
  | {
      status: "failed";
      failureReason: string;
      durationMs: number;
      modelName?: string;
      runtimeName?: string;
    }
  | {
      status: "review_required";
      reviewRequiredReason: string;
      rawText?: string;
      durationMs: number;
      modelName?: string;
      runtimeName?: string;
    };

export type LocalAiReadinessResult = {
  status: "ready" | "degraded" | "unavailable";
  endpointReachable: boolean;
  modelConfigured: boolean;
  modelAvailable: boolean;
  detail: string;
  checkedAt: string;
};
