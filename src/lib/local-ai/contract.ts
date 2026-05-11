// Local AI Contract: types only. No implementation.
// This module is the internal model-call boundary used by the AI Ability Group.

export type LocalAiDebugEvent = {
  eventType: string;
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
