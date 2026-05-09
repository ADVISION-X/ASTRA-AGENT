import type { LocalAiDebugEvent } from "../../../lib/local-ai/runtime-adapters/local-ai-runtime-adapter.js";
import type { ParsedAiAbilityInput } from "../contract.js";
import type {
  AiRuntimeStructuredDebugEvent,
  CollectedDebugState,
  LocalAiDebugSession,
  LocalAiRuntimePortOptions,
} from "./local-ai-runtime-debug-contract.js";
import {
  buildBaseDebugEvent,
  createCollectedDebugState,
  updateDebugState,
} from "./local-ai-runtime-debug-state.js";

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

async function emitDebugEvent(
  emit: LocalAiRuntimePortOptions["emitDebugEvent"],
  event: AiRuntimeStructuredDebugEvent,
) {
  await emit?.(event);
}

async function emitRequestDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
}) {
  await emitDebugEvent(args.emit, {
    eventType: "AI_REQUEST_DEBUG",
    level: "DEBUG",
    status: "started",
    ...args.baseEvent(),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: null,
    durationMs: null,
  });
}

async function emitResponseDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
  durationMs: number | null;
}) {
  await emitDebugEvent(args.emit, {
    eventType: "AI_RESPONSE_DEBUG",
    level: "DEBUG",
    status: "success",
    ...args.baseEvent(),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: null,
    durationMs: args.durationMs,
  });
}

async function emitRawResponseDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
  durationMs: number | null;
}) {
  await emitDebugEvent(args.emit, {
    eventType: "AI_RAW_RESPONSE_DEBUG",
    level: "DEBUG",
    status: "success",
    ...args.baseEvent(),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: null,
    durationMs: args.durationMs,
  });
}

async function emitNormalizedResponseDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
  durationMs: number | null;
}) {
  await emitDebugEvent(args.emit, {
    eventType: "AI_NORMALIZED_RESPONSE_DEBUG",
    level: "DEBUG",
    status: "success",
    ...args.baseEvent(),
    failureReason: null,
    errorKind: null,
    actionableMessage: null,
    ownerResponsible: null,
    durationMs: args.durationMs,
  });
}

async function emitErrorDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
  failureReason: string;
  errorKind: string | null;
  durationMs: number | null;
}) {
  const handling = resolveAiErrorHandling(args.errorKind, args.failureReason);
  await emitDebugEvent(args.emit, {
    eventType: "AI_ERROR_DEBUG",
    level: "ERROR",
    status: "failed",
    ...args.baseEvent(),
    failureReason: args.failureReason,
    errorKind: args.errorKind,
    actionableMessage: handling.actionableMessage,
    ownerResponsible: handling.ownerResponsible,
    durationMs: args.durationMs,
  });
}

function resolveEventDurationMs(event: LocalAiDebugEvent): number | null {
  return "durationMs" in event && typeof event.durationMs === "number" ? event.durationMs : null;
}

async function handleRequestStartedDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  state: CollectedDebugState;
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
}) {
  if (args.state.requestEmitted) {
    return;
  }
  args.state.requestEmitted = true;
  await emitRequestDebug({ emit: args.emit, baseEvent: args.baseEvent });
}

async function handleRawResponseDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  event: LocalAiDebugEvent;
  state: CollectedDebugState;
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
}) {
  if (args.state.rawResponseEmitted) {
    return;
  }
  args.state.rawResponseEmitted = true;
  await emitRawResponseDebug({ emit: args.emit, baseEvent: args.baseEvent, durationMs: resolveEventDurationMs(args.event) });
}

async function handleNormalizedResponseDebug(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  event: LocalAiDebugEvent;
  state: CollectedDebugState;
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
}) {
  if (args.state.normalizedResponseEmitted) {
    return;
  }
  args.state.normalizedResponseEmitted = true;
  await emitNormalizedResponseDebug({ emit: args.emit, baseEvent: args.baseEvent, durationMs: resolveEventDurationMs(args.event) });
}

async function handleParsedOutputDebug(args: {
  event: LocalAiDebugEvent;
  state: CollectedDebugState;
  emitRuntimeSuccess: (parsedJson: unknown, durationMs: number | null) => Promise<void>;
}) {
  if (!("parsedJson" in args.event)) {
    return;
  }
  args.state.parsedJson = args.event.parsedJson ?? null;
  args.state.parsedDecision = ("parsedDecision" in args.event && args.event.parsedDecision?.trim()) || null;
  await args.emitRuntimeSuccess(args.state.parsedJson, resolveEventDurationMs(args.event));
}

async function handleDebugHookEvent(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  event: LocalAiDebugEvent;
  state: CollectedDebugState;
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
  emitRuntimeSuccess: (parsedJson: unknown, durationMs: number | null) => Promise<void>;
}) {
  updateDebugState(args.state, args.event);
  if (args.event.eventType === "local_ai_runtime_request_started" && !args.state.requestEmitted) {
    await handleRequestStartedDebug({ emit: args.emit, state: args.state, baseEvent: args.baseEvent });
    return;
  }
  if (args.event.eventType === "local_ai_adapter_response_received" && !args.state.rawResponseEmitted) {
    await handleRawResponseDebug({ emit: args.emit, event: args.event, state: args.state, baseEvent: args.baseEvent });
    return;
  }
  if (args.event.eventType === "local_ai_output_normalized" && !args.state.normalizedResponseEmitted) {
    await handleNormalizedResponseDebug({ emit: args.emit, event: args.event, state: args.state, baseEvent: args.baseEvent });
    return;
  }
  if (args.event.eventType === "local_ai_output_parsed") {
    await handleParsedOutputDebug({ event: args.event, state: args.state, emitRuntimeSuccess: args.emitRuntimeSuccess });
  }
}

function createLocalAiDebugSession(args: {
  request: ParsedAiAbilityInput;
  rawOutputRef: string;
  promptDebugRef: string;
  traceId: string;
  runtimeCallId: string | null;
  emitDebugEvent?: LocalAiRuntimePortOptions["emitDebugEvent"];
}): LocalAiDebugSession {
  const state = createCollectedDebugState(args.request, args.promptDebugRef);
  const baseEvent = () => buildBaseDebugEvent({ ...args, state });
  const emitAiRequestDebug = createRequestDebugEmitter({ emit: args.emitDebugEvent, state, baseEvent });
  const emitRuntimeSuccess = createRuntimeSuccessEmitter({ emit: args.emitDebugEvent, state, baseEvent });

  return {
    state,
    emitAiRequestDebug,
    emitAiErrorDebug: (failureReason, errorKind, durationMs, implementationStatus = null) => {
      state.implementationStatus = implementationStatus;
      state.errorKind = errorKind;
      state.runtimeCallId = args.runtimeCallId;
      state.diagnosticPayloadRef = args.rawOutputRef;
      state.schemaIssueCount = state.parserErrors.length > 0 ? state.parserErrors.length : null;
      return emitErrorDebug({
        emit: args.emitDebugEvent,
        baseEvent,
        failureReason,
        errorKind,
        durationMs,
      });
    },
    emitRuntimeSuccess,
    debugHook: (event) => handleDebugHookEvent({
      emit: args.emitDebugEvent,
      event,
      state,
      baseEvent,
      emitRuntimeSuccess,
    }),
  };
}

function createRequestDebugEmitter(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  state: CollectedDebugState;
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
}) {
  return async () => {
    if (args.state.requestEmitted) {
      return;
    }
    args.state.requestEmitted = true;
    await emitRequestDebug({ emit: args.emit, baseEvent: args.baseEvent });
  };
}

function createRuntimeSuccessEmitter(args: {
  emit: LocalAiRuntimePortOptions["emitDebugEvent"];
  state: CollectedDebugState;
  baseEvent: () => Omit<AiRuntimeStructuredDebugEvent, "eventType" | "level" | "status" | "failureReason" | "errorKind" | "actionableMessage" | "ownerResponsible" | "durationMs">;
}) {
  return async (parsedJson: unknown, durationMs: number | null) => {
    args.state.parsedJson = parsedJson;
    if (args.state.responseEmitted) {
      return;
    }
    args.state.responseEmitted = true;
    await emitResponseDebug({ emit: args.emit, baseEvent: args.baseEvent, durationMs });
  };
}

export { createLocalAiDebugSession };
export type {
  AiRuntimeStructuredDebugEvent,
  LocalAiRuntimePortOptions,
};
