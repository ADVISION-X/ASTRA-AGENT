import { createHash } from "node:crypto";

import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";
import {
  CommentSignalTaskRequestSchema,
  OcrTaskRequestSchema,
  ProductSignalTaskRequestSchema,
  VisionTaskRequestSchema,
  type LocalAiHealth,
  type LocalAiInvocationStatus,
  type LocalAiTaskRequest,
  type LocalAiTaskType,
} from "../../../types/local-ai.js";
import { type StructuredAiImageInput } from "../../../types/structured-log.js";
import { VisionProductPresenceRequestInputSchema } from "../../../types/vision-product-presence.js";
import { isLocalAiRuntimeError } from "../../../lib/local-ai/local-ai-runtime-error.js";
import type { LocalAiDebugEvent } from "../../../lib/local-ai/runtime-adapters/local-ai-runtime-adapter.js";
import type {
  AiAbilityInput,
  AiRuntimeExecutionOutput,
  AiRuntimeHealth,
  ParsedAiAbilityInput,
  AiTaskType,
} from "../contract.js";
import type { AiRuntimePort } from "../ports/ai-runtime-port.js";
import { AiRuntimeExecutionOutputSchema, AiRuntimeHealthSchema } from "../schema.js";
import { parseExtractedJson } from "../shared/ai-json-extract.js";
import { buildStableAiRef } from "../shared/ai-types.js";
import { buildAiRuntimeCallIdentity } from "../runtime/ai-idempotency.js";
import { resolveAiTimeoutPolicy } from "../runtime/ai-timeout-policy-gate.js";

const AI_TASK_BY_LEGACY: Record<LocalAiTaskType, AiTaskType> = {
  "vision.productPresence": "product_presence_judgment",
  "comments.ocr_cleanup": "ocr_cleanup",
  "comments.intent_analysis": "comment_signal_summary",
  "product.signal_summary": "product_signal_summary",
};

const MAX_CONCURRENT_RUNS = 1;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000;

type CircuitBreakerState = "closed" | "open" | "half_open" | "not_applicable";

type CircuitBreaker = {
  failureCount: number;
  openedAtMs: number | null;
};

type ProtectedGatewayResult =
  | { ok: true; result: Awaited<ReturnType<LocalAiGateway["execute"]>>; gatewayDurationMs: number }
  | { ok: false; message: string; implementationStatus: string; gatewayDurationMs: number; errorKind: string | null; errorDetail: string | null };

export type AiRuntimeStructuredDebugEvent = {
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

export type LocalAiRuntimePortOptions = {
  emitDebugEvent?: (event: AiRuntimeStructuredDebugEvent) => void | Promise<void>;
};

const circuitBreaker: CircuitBreaker = {
  failureCount: 0,
  openedAtMs: null,
};

let activeRuns = 0;

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toStructuredImageInputs(items: LocalAiDebugEvent["imageInputs"] | undefined): StructuredAiImageInput[] {
  return (items ?? []).map((item) => ({
    refId: normalizeText(item.refId),
    artifactRef: normalizeText(item.artifactRef),
    filePath: normalizeText(item.filePath),
    hash: normalizeText(item.hash),
    bytes: typeof item.bytes === "number" ? item.bytes : null,
    width: typeof item.width === "number" ? item.width : null,
    height: typeof item.height === "number" ? item.height : null,
  }));
}

function resolveAiErrorHandling(kind: string | null, failureReason: string): { ownerResponsible: string; actionableMessage: string } {
  if (kind === "missing_evidence") {
    return {
      ownerResponsible: "Screenshot / Orchestration",
      actionableMessage: "Run prepare-ai-input through Screenshot before retrying the AI task.",
    };
  }

  if (kind === "engine_missing" || kind === "model_missing" || kind === "service_unreachable") {
    return {
      ownerResponsible: "AI Capability / Local AI Runtime",
      actionableMessage: "Restore the configured local AI runtime or install the governed local model before retrying.",
    };
  }

  if (kind === "invalid_output") {
    return {
      ownerResponsible: "AI Capability / Local AI Runtime",
      actionableMessage: "Inspect the raw model response and parser errors before retrying the governed AI task.",
    };
  }

  if (kind === "runtime_timeout") {
    return {
      ownerResponsible: "AI Capability / Local AI Runtime",
      actionableMessage: "Increase timeout only through governed policy or repair the local model latency before retrying.",
    };
  }

  return {
    ownerResponsible: "AI Capability / Local AI Runtime",
    actionableMessage: failureReason,
  };
}

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

function createCollectedDebugState(request: ParsedAiAbilityInput, promptDebugRef: string): CollectedDebugState {
  return {
    provider: "local",
    model: null,
    modelRole: null,
    runtime: null,
    promptContractId: request.promptContractId,
    promptVersion: null,
    outputSchemaRef: request.expectedOutputSchema,
    promptDebugRef,
    systemPromptHash: null,
    userPromptHash: null,
    promptPreview: null,
    promptFullText: null,
    rawResponsePreview: null,
    rawResponseText: null,
    parsedJson: null,
    parsedDecision: null,
    parserErrors: [],
    sourceScreenshotEvidenceId: null,
    aiInputArtifactRef: request.inputRefs[0]?.id ?? null,
    imageInputs: [],
    tokenEstimate: null,
    requestEmitted: false,
    responseEmitted: false,
  };
}

function describeHealth(health: AiRuntimeHealth): string {
  return JSON.stringify({
    overallStatus: health.overallStatus,
    implementationStatus: health.implementationStatus,
    dependencies: health.dependencies,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}

function getCircuitBreakerState(nowMs: number): CircuitBreakerState {
  if (circuitBreaker.openedAtMs === null) {
    return "closed";
  }
  if (nowMs - circuitBreaker.openedAtMs >= CIRCUIT_OPEN_MS) {
    return "half_open";
  }
  return "open";
}

function recordCircuitSuccess() {
  circuitBreaker.failureCount = 0;
  circuitBreaker.openedAtMs = null;
}

function recordCircuitFailure(nowMs: number) {
  circuitBreaker.failureCount += 1;
  if (circuitBreaker.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitBreaker.openedAtMs = nowMs;
  }
}

function timeoutMessage(timeoutMs: number): string {
  return `Local AI runtime timed out after ${timeoutMs}ms.`;
}

async function executeWithTimeout(input: {
  gateway: LocalAiGateway;
  request: LocalAiTaskRequest;
  timeoutMs: number;
  debugHook?: (event: LocalAiDebugEvent) => void | Promise<void>;
}): Promise<ProtectedGatewayResult> {
  const controller = new AbortController();
  const startedAtMs = performance.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const gatewayPromise = input.gateway.execute(input.request);
    const timeoutPromise = new Promise<ProtectedGatewayResult>((resolve) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        resolve({
          ok: false,
          message: timeoutMessage(input.timeoutMs),
          implementationStatus: "runtime_timeout",
          gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
          errorKind: "runtime_timeout",
          errorDetail: null,
        });
      }, input.timeoutMs);
    });

    const result = await Promise.race([
      gatewayPromise.then((value): ProtectedGatewayResult => ({
        ok: true,
        result: value,
        gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
      })),
      timeoutPromise,
    ]);

    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Local AI runtime failed.",
      implementationStatus: "runtime_threw",
      gatewayDurationMs: Math.max(0, performance.now() - startedAtMs),
      errorKind: isLocalAiRuntimeError(error) ? error.code : "runtime_threw",
      errorDetail: isLocalAiRuntimeError(error) ? (error.detail ?? null) : null,
    };
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

function toAiRuntimeHealth(health: LocalAiHealth): AiRuntimeHealth {
  return AiRuntimeHealthSchema.parse({
    overallStatus: health.overallStatus,
    implementationStatus: health.implementationStatus,
    dependencies: {
      gateway: health.ollamaStatus,
      vision: health.visionModelStatus,
      text: health.textModelStatus,
      ocr: health.ocrStatus,
    },
    configuredModels: health.configuredModels,
    availableModels: health.availableModels,
    lastCheckedAt: health.lastCheckedAt,
    failureReason: health.failureReason,
    lastTaskType: health.lastTaskType ? AI_TASK_BY_LEGACY[health.lastTaskType] : null,
    lastFailureReason: health.lastFailureReason,
    lastInvocationStatus: health.lastInvocationStatus,
  });
}

function coerceRuntimeOutput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = parseExtractedJson(value);
  return parsed.ok ? parsed.value : value;
}

function toLocalAiTaskRequest(input: AiAbilityInput): { ok: true; request: LocalAiTaskRequest } | { ok: false; message: string } {
  switch (input.taskType) {
    case "product_presence_judgment":
    case "visual_observation":
    case "visual_target_candidate_analysis":
      return {
        ok: true,
        request: VisionTaskRequestSchema.parse({
          id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
          taskType: "vision.productPresence",
          modelRole: "vision",
          promptVersion: "v1",
          schemaVersion: "vision.productPresence.schema.v1",
          evidenceRefs: input.inputRefs,
          input: VisionProductPresenceRequestInputSchema.parse(input.input),
        }),
      };
    case "ocr_cleanup":
      return {
        ok: true,
        request: OcrTaskRequestSchema.parse({
          id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
          taskType: "comments.ocr_cleanup",
          modelRole: "ocr",
          promptVersion: "comments.ocr_cleanup.v1",
          schemaVersion: "ocr-text.v1",
          evidenceRefs: input.inputRefs,
          input: input.input,
        }),
      };
    case "comment_signal_summary":
      return {
        ok: true,
        request: CommentSignalTaskRequestSchema.parse({
          id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
          taskType: "comments.intent_analysis",
          modelRole: "commentUnderstanding",
          promptVersion: "comments.intent_analysis.v1",
          schemaVersion: "comment-signal.v1",
          evidenceRefs: input.inputRefs,
          input: input.input,
        }),
      };
    case "product_signal_summary":
      {
        const typedInput = input.input;
        return {
          ok: true,
          request: ProductSignalTaskRequestSchema.parse({
            id: `${input.sessionId}:${input.taskType}:${input.roundId ?? "no-round"}`,
            taskType: "product.signal_summary",
            modelRole: "productSignal",
            promptVersion: "product.signal_summary.v1",
            schemaVersion: "product-opportunity-candidate.v1",
            evidenceRefs: input.inputRefs,
            input: {
              videoSummary: typedInput.videoSummary,
              productPresence: {
                taskType: "vision.productPresence",
                promptId: "vision.productPresence.v1",
                promptVersion: "v1",
                schemaVersion: "vision.productPresence.schema.v1",
                ...typedInput.productPresence,
              },
              commentSignals: typedInput.commentSignals,
            },
          }),
        };
      }
    case "evidence_packet_analysis":
    case "schema_validation_only":
      return {
        ok: false,
        message: `Local AI runtime adapter is not authorized to execute ${input.taskType}.`,
      };
  }
}

export function createLocalAiRuntimePort(options: LocalAiRuntimePortOptions = {}): AiRuntimePort {
  const gateway = new LocalAiGateway();

  return {
    async execute(request): Promise<AiRuntimeExecutionOutput> {
      const timeoutPolicy = resolveAiTimeoutPolicy(request);
      const identity = buildAiRuntimeCallIdentity(request);
      const rawOutputRef = buildStableAiRef("ai-raw-output", [request.sessionId, request.taskType, request.roundId, identity.requestHash.slice(0, 16)]);
      const promptDebugRef = buildStableAiRef("ai-prompt-debug", [request.sessionId, request.taskType, request.roundId, identity.requestHash.slice(0, 16)]);
      const debugState = createCollectedDebugState(request, promptDebugRef);
      const modelHealthBefore = describeHealth(toAiRuntimeHealth(await gateway.getRuntimeHealth()));
      const circuitStateBefore = getCircuitBreakerState(performance.now());
      const baseDebugEvent = () => ({
        sessionId: request.sessionId,
        missionId: request.missionId,
        roundId: request.roundId,
        videoVisitId: request.videoVisitId,
        traceId: identity.requestHash,
        spanId: identity.runtimeCallId ?? `${request.sessionId}:${request.taskType}`,
        attemptId: `${identity.runtimeCallId ?? request.sessionId}:attempt:0`,
        taskType: request.taskType,
        refs: request.inputRefs.map((ref) => ref.id),
        provider: debugState.provider,
        model: debugState.model,
        modelRole: debugState.modelRole,
        runtime: debugState.runtime,
        promptContractId: debugState.promptContractId,
        promptVersion: debugState.promptVersion,
        outputSchemaRef: debugState.outputSchemaRef,
        promptDebugRef,
        systemPromptHash: debugState.systemPromptHash,
        userPromptHash: debugState.userPromptHash,
        promptPreview: debugState.promptPreview,
        promptFullText: debugState.promptFullText,
        rawResponsePreview: debugState.rawResponsePreview,
        rawResponseText: debugState.rawResponseText,
        rawResponseHash: debugState.rawResponseText ? hashValue(debugState.rawResponseText) : null,
        rawResponseRef: rawOutputRef,
        parsedJson: debugState.parsedJson,
        parsedDecision: debugState.parsedDecision,
        parserErrors: [...debugState.parserErrors],
        sourceScreenshotEvidenceId: debugState.sourceScreenshotEvidenceId,
        aiInputArtifactRef: debugState.aiInputArtifactRef,
        imageInputs: [...debugState.imageInputs],
        tokenEstimate: debugState.tokenEstimate,
      });
      const emitDebugEvent = async (event: AiRuntimeStructuredDebugEvent) => {
        await options.emitDebugEvent?.(event);
      };
      const emitAiErrorDebug = async (failureReason: string, errorKind: string | null, durationMs: number | null) => {
        const handling = resolveAiErrorHandling(errorKind, failureReason);
        await emitDebugEvent({
          eventType: "AI_ERROR_DEBUG",
          level: "ERROR",
          status: "failed",
          ...baseDebugEvent(),
          failureReason,
          errorKind,
          actionableMessage: handling.actionableMessage,
          ownerResponsible: handling.ownerResponsible,
          durationMs,
        });
      };
      const debugHook = async (event: LocalAiDebugEvent) => {
        debugState.model = normalizeText(event.modelName) ?? debugState.model;
        debugState.modelRole = normalizeText(event.modelRole) ?? debugState.modelRole;
        debugState.runtime = normalizeText(event.runtime) ?? debugState.runtime;
        debugState.promptContractId = normalizeText(event.promptContractId) ?? debugState.promptContractId;
        debugState.promptVersion = normalizeText(event.promptVersion) ?? debugState.promptVersion;
        debugState.outputSchemaRef = normalizeText(event.outputSchemaRef) ?? debugState.outputSchemaRef;
        debugState.systemPromptHash = normalizeText(event.systemPromptHash) ?? debugState.systemPromptHash;
        debugState.userPromptHash = normalizeText(event.userPromptHash) ?? debugState.userPromptHash;
        debugState.promptPreview = normalizeText(event.promptPreview) ?? debugState.promptPreview;
        debugState.promptFullText = normalizeText(event.promptFullText) ?? debugState.promptFullText;
        debugState.rawResponsePreview = normalizeText(event.rawResponsePreview) ?? debugState.rawResponsePreview;
        debugState.rawResponseText = normalizeText(event.rawResponseText) ?? debugState.rawResponseText;
        debugState.sourceScreenshotEvidenceId = normalizeText(event.sourceScreenshotEvidenceId) ?? debugState.sourceScreenshotEvidenceId;
        debugState.aiInputArtifactRef = normalizeText(event.aiInputArtifactRef) ?? debugState.aiInputArtifactRef;
        debugState.tokenEstimate = typeof event.tokenEstimate === "number" ? event.tokenEstimate : debugState.tokenEstimate;
        if ((event.imageInputs ?? []).length > 0) {
          debugState.imageInputs = toStructuredImageInputs(event.imageInputs);
        }
        if (event.eventType === "local_ai_runtime_request_started" && !debugState.requestEmitted) {
          debugState.requestEmitted = true;
          await emitDebugEvent({
            eventType: "AI_REQUEST_DEBUG",
            level: "DEBUG",
            status: "started",
            ...baseDebugEvent(),
            failureReason: null,
            errorKind: null,
            actionableMessage: null,
            ownerResponsible: null,
            durationMs: null,
          });
          return;
        }

        if (event.eventType === "local_ai_output_parsed") {
          debugState.parsedJson = event.parsedJson ?? null;
          debugState.parsedDecision = normalizeText(event.parsedDecision) ?? null;
          if (!debugState.responseEmitted) {
            debugState.responseEmitted = true;
            await emitDebugEvent({
              eventType: "AI_RESPONSE_DEBUG",
              level: "DEBUG",
              status: "success",
              ...baseDebugEvent(),
              failureReason: null,
              errorKind: null,
              actionableMessage: null,
              ownerResponsible: null,
              durationMs: typeof event.durationMs === "number" ? event.durationMs : null,
            });
          }
        }
      };

      if (circuitStateBefore === "open") {
        await emitAiErrorDebug("Local AI circuit breaker is open.", "circuit_breaker_open", 0);
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: "unavailable",
          modelRole: request.taskType === "ocr_cleanup" ? "ocr" : request.taskType === "comment_signal_summary" || request.taskType === "product_signal_summary" ? "multi-role" : "vision",
          runtime: "local-adapter",
          implementationStatus: "circuit_breaker_open",
          createdAt: null,
          confidence: null,
          costEstimate: 0,
          output: { message: "Local AI circuit breaker is open." },
          rawOutputRef,
          rawOutputHash: hashValue("circuit_breaker_open"),
          runtimeCallId: identity.runtimeCallId,
          timeoutMs: timeoutPolicy.timeoutMs,
          attemptIndex: 0,
          retryCount: 0,
          circuitBreakerState: circuitStateBefore,
          gatewayDurationMs: 0,
          modelHealthBefore,
          modelHealthAfter: modelHealthBefore,
        });
      }

      if (activeRuns >= MAX_CONCURRENT_RUNS) {
        await emitAiErrorDebug("Local AI runtime concurrency limit reached.", "concurrency_limited", 0);
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: "unavailable",
          modelRole: request.taskType === "ocr_cleanup" ? "ocr" : request.taskType === "comment_signal_summary" || request.taskType === "product_signal_summary" ? "multi-role" : "vision",
          runtime: "local-adapter",
          implementationStatus: "concurrency_limited",
          createdAt: null,
          confidence: null,
          costEstimate: 0,
          output: { message: "Local AI runtime concurrency limit reached." },
          rawOutputRef,
          rawOutputHash: hashValue("concurrency_limited"),
          runtimeCallId: identity.runtimeCallId,
          timeoutMs: timeoutPolicy.timeoutMs,
          attemptIndex: 0,
          retryCount: 0,
          circuitBreakerState: circuitStateBefore,
          gatewayDurationMs: 0,
          modelHealthBefore,
          modelHealthAfter: modelHealthBefore,
        });
      }

      const converted = toLocalAiTaskRequest(request);
      if (converted.ok === false) {
        await emitAiErrorDebug(converted.message, "task_type_mismatch", 0);
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: "unavailable",
          modelRole: request.taskType === "ocr_cleanup" ? "ocr" : request.taskType === "comment_signal_summary" || request.taskType === "product_signal_summary" ? "multi-role" : "vision",
          runtime: "local-adapter",
          implementationStatus: "task_type_mismatch",
          createdAt: null,
          confidence: null,
          costEstimate: 0,
          output: { message: converted.message },
          rawOutputRef,
          rawOutputHash: hashValue(converted.message),
          runtimeCallId: identity.runtimeCallId,
          timeoutMs: timeoutPolicy.timeoutMs,
          attemptIndex: 0,
          retryCount: 0,
          circuitBreakerState: circuitStateBefore,
          gatewayDurationMs: 0,
          modelHealthBefore,
          modelHealthAfter: modelHealthBefore,
        });
      }

      activeRuns += 1;
      try {
        const protectedResult = await executeWithTimeout({
          gateway,
          request: converted.request,
          timeoutMs: timeoutPolicy.timeoutMs,
          debugHook,
        });
        const modelHealthAfter = describeHealth(toAiRuntimeHealth(await gateway.getRuntimeHealth()));

        if (protectedResult.ok === false) {
          recordCircuitFailure(performance.now());
          if (protectedResult.errorKind === "invalid_output" && protectedResult.errorDetail) {
            debugState.parserErrors = [protectedResult.message];
            debugState.rawResponseText = debugState.rawResponseText ?? protectedResult.errorDetail;
            debugState.rawResponsePreview = debugState.rawResponsePreview ?? protectedResult.errorDetail.slice(0, 220);
          }
          await emitAiErrorDebug(protectedResult.message, protectedResult.errorKind, protectedResult.gatewayDurationMs);
          return AiRuntimeExecutionOutputSchema.parse({
            modelProvider: "local",
            modelName: "unavailable",
            modelRole: request.taskType === "ocr_cleanup" ? "ocr" : request.taskType === "comment_signal_summary" || request.taskType === "product_signal_summary" ? "multi-role" : "vision",
            runtime: "local-adapter",
            implementationStatus: protectedResult.implementationStatus,
            createdAt: null,
            confidence: null,
            costEstimate: 0,
            output: {
              message: protectedResult.message,
            },
            rawOutputRef,
            rawOutputHash: hashValue(protectedResult.message),
            runtimeCallId: identity.runtimeCallId,
            timeoutMs: timeoutPolicy.timeoutMs,
            attemptIndex: 0,
            retryCount: 0,
            circuitBreakerState: getCircuitBreakerState(performance.now()),
            gatewayDurationMs: protectedResult.gatewayDurationMs,
            modelHealthBefore,
            modelHealthAfter,
          });
        }

        recordCircuitSuccess();
        const result = protectedResult.result;
        const runtimeOutput = coerceRuntimeOutput(result.result);
        if (!debugState.responseEmitted) {
          debugState.parsedJson = runtimeOutput;
          await emitDebugEvent({
            eventType: "AI_RESPONSE_DEBUG",
            level: "DEBUG",
            status: "success",
            ...baseDebugEvent(),
            failureReason: null,
            errorKind: null,
            actionableMessage: null,
            ownerResponsible: null,
            durationMs: protectedResult.gatewayDurationMs,
          });
        }
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: result.model,
          modelRole: result.modelRole,
          runtime: result.runtime,
          implementationStatus: result.implementationStatus,
          createdAt: result.createdAt,
          confidence: result.confidence,
          costEstimate: 0,
          output: runtimeOutput,
          rawOutputRef,
          rawOutputHash: debugState.rawResponseText ? hashValue(debugState.rawResponseText) : hashValue(runtimeOutput),
          runtimeCallId: identity.runtimeCallId,
          timeoutMs: timeoutPolicy.timeoutMs,
          attemptIndex: 0,
          retryCount: 0,
          circuitBreakerState: getCircuitBreakerState(performance.now()),
          gatewayDurationMs: protectedResult.gatewayDurationMs,
          modelHealthBefore,
          modelHealthAfter,
        });
      } catch (error) {
        recordCircuitFailure(performance.now());
        const modelHealthAfter = describeHealth(toAiRuntimeHealth(await gateway.getRuntimeHealth()));
        const message = error instanceof Error ? error.message : "Local AI runtime failed.";
        await emitAiErrorDebug(message, isLocalAiRuntimeError(error) ? error.code : "runtime_threw", null);
        return AiRuntimeExecutionOutputSchema.parse({
          modelProvider: "local",
          modelName: "unavailable",
          modelRole: request.taskType === "ocr_cleanup" ? "ocr" : request.taskType === "comment_signal_summary" || request.taskType === "product_signal_summary" ? "multi-role" : "vision",
          runtime: "local-adapter",
          implementationStatus: "runtime_threw",
          createdAt: null,
          confidence: null,
          costEstimate: 0,
          output: {
            message,
          },
          rawOutputRef,
          rawOutputHash: hashValue(message),
          runtimeCallId: identity.runtimeCallId,
          timeoutMs: timeoutPolicy.timeoutMs,
          attemptIndex: 0,
          retryCount: 0,
          circuitBreakerState: getCircuitBreakerState(performance.now()),
          gatewayDurationMs: null,
          modelHealthBefore,
          modelHealthAfter,
        });
      } finally {
        activeRuns = Math.max(0, activeRuns - 1);
      }
    },
    async getHealth() {
      const report = await gateway.getHealth();
      return {
        ok: report.ok,
        detail: report.detail,
        health: toAiRuntimeHealth(report.health),
      };
    },
    async getRuntimeHealth() {
      return toAiRuntimeHealth(await gateway.getRuntimeHealth());
    },
  };
}
