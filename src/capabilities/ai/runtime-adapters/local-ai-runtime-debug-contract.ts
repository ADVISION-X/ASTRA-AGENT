import type { LocalAiDebugEvent } from "../../../lib/local-ai/runtime-adapters/local-ai-runtime-adapter.js";
import { type StructuredAiImageInput } from "../../../types/structured-log.js";
import type { AiTaskType } from "../contract.js";

type AiRuntimeStructuredDebugEvent = {
  eventType: "AI_REQUEST_DEBUG" | "AI_RESPONSE_DEBUG" | "AI_ERROR_DEBUG";
  level: "DEBUG" | "ERROR";
  status: "started" | "success" | "failed" | "review_required";
  sessionId: string;
  missionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  traceId: string;
  spanId: string;
  attemptId: string;
  taskType: AiTaskType;
  refs: string[];
  provider: string | null;
  model: string | null;
  modelRole: string | null;
  runtime: string | null;
  promptContractId: string | null;
  promptVersion: string | null;
  outputSchemaRef: string | null;
  promptDebugRef: string | null;
  systemPromptHash: string | null;
  userPromptHash: string | null;
  promptPreview: string | null;
  promptFullText: string | null;
  rawResponsePreview: string | null;
  rawResponseText: string | null;
  rawResponseHash: string | null;
  rawResponseRef: string | null;
  promptCatalogVersion: string | null;
  providerConfigRef: string | null;
  secretRef: string | null;
  inputPackageId: string | null;
  inputPackageVersion: string | null;
  inputPackageHash: string | null;
  capabilityCatalogVersion: string | null;
  outputSchemaCatalogVersion: string | null;
  mapPackageSchemaVersion: string | null;
  promptDebugBundleRef: string | null;
  providerRequestBodyRedacted: unknown | null;
  providerRequestDebugRef: string | null;
  parsedJson: unknown | null;
  parsedDecision: string | null;
  parserErrors: string[];
  sourceScreenshotEvidenceId: string | null;
  aiInputArtifactRef: string | null;
  imageInputs: StructuredAiImageInput[];
  tokenEstimate: number | null;
  failureReason: string | null;
  errorKind: string | null;
  actionableMessage: string | null;
  ownerResponsible: string | null;
  durationMs: number | null;
};

type LocalAiRuntimePortOptions = {
  emitDebugEvent?: (event: AiRuntimeStructuredDebugEvent) => void | Promise<void>;
};

type CollectedDebugState = {
  provider: string | null;
  model: string | null;
  modelRole: string | null;
  runtime: string | null;
  promptContractId: string | null;
  promptVersion: string | null;
  outputSchemaRef: string | null;
  promptDebugRef: string;
  systemPromptHash: string | null;
  userPromptHash: string | null;
  promptPreview: string | null;
  promptFullText: string | null;
  rawResponsePreview: string | null;
  rawResponseText: string | null;
  providerRequestBodyRedacted: unknown | null;
  parsedJson: unknown | null;
  parsedDecision: string | null;
  parserErrors: string[];
  sourceScreenshotEvidenceId: string | null;
  aiInputArtifactRef: string | null;
  imageInputs: StructuredAiImageInput[];
  tokenEstimate: number | null;
  requestEmitted: boolean;
  responseEmitted: boolean;
};

type LocalAiDebugSession = {
  state: CollectedDebugState;
  debugHook: (event: LocalAiDebugEvent) => Promise<void>;
  emitAiErrorDebug: (failureReason: string, errorKind: string | null, durationMs: number | null) => Promise<void>;
  emitRuntimeSuccess: (parsedJson: unknown, durationMs: number | null) => Promise<void>;
};

export type {
  AiRuntimeStructuredDebugEvent,
  LocalAiRuntimePortOptions,
  CollectedDebugState,
  LocalAiDebugSession,
};
