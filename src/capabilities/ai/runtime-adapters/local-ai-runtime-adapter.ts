import type { AiRuntimeExecutionOutput } from "../contract.js";
import type { AiRuntimePort } from "../ports/ai-runtime-port.js";
import { executeWithTimeout, isLocalAiRuntimeError, LocalAiGateway, type ProtectedGatewayResult } from "./local-ai-gateway.js";
import * as runtimeContext from "./local-ai-runtime-context-support.js";
import * as runtimeDebug from "./local-ai-runtime-debug.js";
import { hashValue } from "./local-ai-runtime-debug-state.js";
import * as runtimeMapper from "./local-ai-runtime-mapper.js";
import * as runtimeOutput from "./local-ai-runtime-output.js";

const MAX_CONCURRENT_RUNS = 1;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000;

type CircuitBreaker = {
  failureCount: number;
  openedAtMs: number | null;
};

type LocalAiRuntimeState = {
  circuitBreaker: CircuitBreaker;
  activeRuns: number;
};

type ExecuteRequest = Parameters<AiRuntimePort["execute"]>[0];
type ExecuteOptions = Parameters<AiRuntimePort["execute"]>[1];
type LocalAiTaskRequest = Parameters<LocalAiGateway["execute"]>[0];
type LocalAiTaskResult = Awaited<ReturnType<LocalAiGateway["execute"]>>;
type LocalAiExecutionContext = {
  request: ExecuteRequest;
  signal?: AbortSignal;
  identity: ReturnType<typeof runtimeContext.buildAiRuntimeCallIdentity>;
  timeoutMs: number;
  rawOutputRef: string;
  modelHealthBefore: string;
  circuitBreakerState: runtimeOutput.LocalAiCircuitBreakerState;
  debugSession: ReturnType<typeof runtimeDebug.createLocalAiDebugSession>;
};

function createLocalAiRuntimeState(): LocalAiRuntimeState {
  return {
    circuitBreaker: {
      failureCount: 0,
      openedAtMs: null,
    },
    activeRuns: 0,
  };
}

function getCircuitBreakerState(state: LocalAiRuntimeState, nowMs: number): runtimeOutput.LocalAiCircuitBreakerState {
  if (state.circuitBreaker.openedAtMs === null) {
    return "closed";
  }
  if (nowMs - state.circuitBreaker.openedAtMs >= CIRCUIT_OPEN_MS) {
    return "half_open";
  }
  return "open";
}

function recordCircuitSuccess(state: LocalAiRuntimeState) {
  state.circuitBreaker.failureCount = 0;
  state.circuitBreaker.openedAtMs = null;
}

function recordCircuitFailure(state: LocalAiRuntimeState, nowMs: number) {
  state.circuitBreaker.failureCount += 1;
  if (state.circuitBreaker.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    state.circuitBreaker.openedAtMs = nowMs;
  }
}

export function createLocalAiRuntimePort(options: runtimeDebug.LocalAiRuntimePortOptions = {}): AiRuntimePort {
  const gateway = new LocalAiGateway();
  const state = createLocalAiRuntimeState();
  return {
    execute: (request, executeOptions) => executeLocalAiRuntimeRequest(gateway, state, request, options, executeOptions),
    async getHealth() {
      const report = await gateway.getHealth();
      return {
        ok: report.ok,
        detail: report.detail,
        health: runtimeMapper.toAiRuntimeHealth(report.health),
      };
    },
    async getRuntimeHealth() {
      return runtimeMapper.toAiRuntimeHealth(await gateway.getRuntimeHealth());
    },
  };
}

async function createExecutionContext(
  gateway: LocalAiGateway,
  state: LocalAiRuntimeState,
  request: ExecuteRequest,
  options: runtimeDebug.LocalAiRuntimePortOptions,
  executeOptions?: ExecuteOptions,
): Promise<LocalAiExecutionContext> {
  const identity = runtimeContext.buildAiRuntimeCallIdentity(request);
  const rawOutputRef = runtimeContext.buildStableAiRef("ai-raw-output", [request.sessionId, request.taskType, request.roundId, identity.requestHash.slice(0, 16)]);
  const promptDebugRef = runtimeContext.buildStableAiRef("ai-prompt-debug", [request.sessionId, request.taskType, request.roundId, identity.requestHash.slice(0, 16)]);
  return {
    request,
    signal: executeOptions?.signal,
    identity,
    timeoutMs: runtimeContext.resolveAiTimeoutPolicy(request).timeoutMs,
    rawOutputRef,
    modelHealthBefore: runtimeMapper.describeHealth(runtimeMapper.toAiRuntimeHealth(await gateway.getRuntimeHealth())),
    circuitBreakerState: getCircuitBreakerState(state, performance.now()),
    debugSession: runtimeDebug.createLocalAiDebugSession({
      request,
      rawOutputRef,
      promptDebugRef,
      traceId: identity.requestHash,
      runtimeCallId: identity.runtimeCallId,
      emitDebugEvent: options.emitDebugEvent,
    }),
  };
}

async function rejectExecution(
  context: LocalAiExecutionContext,
  input: { implementationStatus: string; message: string; errorKind: string | null; gatewayDurationMs: number | null; modelHealthAfter: string },
): Promise<AiRuntimeExecutionOutput> {
  await context.debugSession.emitAiErrorDebug(input.message, input.errorKind, input.gatewayDurationMs);
  return runtimeOutput.buildLocalAiFailureOutput({
    taskType: context.request.taskType,
    implementationStatus: input.implementationStatus,
    message: input.message,
    rawOutputRef: context.rawOutputRef,
    rawOutputHash: hashValue(input.message),
    runtimeCallId: context.identity.runtimeCallId,
    timeoutMs: context.timeoutMs,
    circuitBreakerState: input.implementationStatus === "circuit_breaker_open" ? context.circuitBreakerState : getCircuitBreakerState(performance.now()),
    gatewayDurationMs: input.gatewayDurationMs,
    modelHealthBefore: context.modelHealthBefore,
    modelHealthAfter: input.modelHealthAfter,
  });
}

async function runConvertedRequest(
  gateway: LocalAiGateway,
  state: LocalAiRuntimeState,
  context: LocalAiExecutionContext,
  localRequest: LocalAiTaskRequest,
): Promise<AiRuntimeExecutionOutput> {
  try {
    const protectedResult = await executeWithTimeout<LocalAiTaskResult>({
      execute: async (signal) => gateway.execute(localRequest, { signal }),
      timeoutMs: context.timeoutMs,
      signal: context.signal,
    });
    if (protectedResult.ok === false) {
      return handleProtectedFailure(gateway, state, context, protectedResult);
    }
    return handleProtectedSuccess(gateway, state, context, protectedResult);
  } catch (error) {
    recordCircuitFailure(state, performance.now());
    return rejectExecution(context, {
      implementationStatus: "runtime_threw",
      message: error instanceof Error ? error.message : "Local AI runtime failed.",
      errorKind: isLocalAiRuntimeError(error) ? error.code : "runtime_threw",
      gatewayDurationMs: null,
      modelHealthAfter: runtimeMapper.describeHealth(runtimeMapper.toAiRuntimeHealth(await gateway.getRuntimeHealth())),
    });
  }
}

async function handleProtectedFailure(
  gateway: LocalAiGateway,
  state: LocalAiRuntimeState,
  context: LocalAiExecutionContext,
  protectedResult: ProtectedGatewayResult<LocalAiTaskResult> & { ok: false },
): Promise<AiRuntimeExecutionOutput> {
  recordCircuitFailure(state, performance.now());
  if (protectedResult.errorKind === "invalid_output" && protectedResult.errorDetail) {
    context.debugSession.state.parserErrors = [protectedResult.message];
    context.debugSession.state.rawResponseText = context.debugSession.state.rawResponseText ?? protectedResult.errorDetail;
    context.debugSession.state.rawResponsePreview = context.debugSession.state.rawResponsePreview ?? protectedResult.errorDetail.slice(0, 220);
  }
  return rejectExecution(context, {
    implementationStatus: protectedResult.implementationStatus,
    message: protectedResult.message,
    errorKind: protectedResult.errorKind,
    gatewayDurationMs: protectedResult.gatewayDurationMs,
    modelHealthAfter: runtimeMapper.describeHealth(runtimeMapper.toAiRuntimeHealth(await gateway.getRuntimeHealth())),
  });
}

async function handleProtectedSuccess(
  gateway: LocalAiGateway,
  state: LocalAiRuntimeState,
  context: LocalAiExecutionContext,
  protectedResult: ProtectedGatewayResult<LocalAiTaskResult> & { ok: true },
): Promise<AiRuntimeExecutionOutput> {
  recordCircuitSuccess(state);
  const runtimeOutputValue = runtimeMapper.coerceRuntimeOutput(protectedResult.result.result);
  const modelHealthAfter = runtimeMapper.describeHealth(runtimeMapper.toAiRuntimeHealth(await gateway.getRuntimeHealth()));
  await context.debugSession.emitRuntimeSuccess(runtimeOutputValue, protectedResult.gatewayDurationMs);
  const rawOutputHash = context.debugSession.state.rawResponseText ? hashValue(context.debugSession.state.rawResponseText) : hashValue(runtimeOutputValue);
  return runtimeOutput.buildLocalAiSuccessOutput({
    modelName: protectedResult.result.model,
    modelRole: protectedResult.result.modelRole,
    runtime: protectedResult.result.runtime,
    implementationStatus: protectedResult.result.implementationStatus,
    createdAt: protectedResult.result.createdAt,
    confidence: protectedResult.result.confidence,
    output: runtimeOutputValue,
    rawOutputRef: context.rawOutputRef,
    rawOutputHash,
    runtimeCallId: context.identity.runtimeCallId,
    timeoutMs: context.timeoutMs,
    circuitBreakerState: getCircuitBreakerState(state, performance.now()),
    gatewayDurationMs: protectedResult.gatewayDurationMs,
    modelHealthBefore: context.modelHealthBefore,
    modelHealthAfter,
  });
}

async function executeLocalAiRuntimeRequest(
  gateway: LocalAiGateway,
  state: LocalAiRuntimeState,
  request: ExecuteRequest,
  options: runtimeDebug.LocalAiRuntimePortOptions,
  executeOptions?: ExecuteOptions,
): Promise<AiRuntimeExecutionOutput> {
  const context = await createExecutionContext(gateway, state, request, options, executeOptions);
  if (context.circuitBreakerState === "open") {
    return rejectExecution(context, {
      implementationStatus: "circuit_breaker_open",
      message: "Local AI circuit breaker is open.",
      errorKind: "circuit_breaker_open",
      gatewayDurationMs: 0,
      modelHealthAfter: context.modelHealthBefore,
    });
  }
  if (state.activeRuns >= MAX_CONCURRENT_RUNS) {
    return rejectExecution(context, {
      implementationStatus: "concurrency_limited",
      message: "Local AI runtime concurrency limit reached.",
      errorKind: "concurrency_limited",
      gatewayDurationMs: 0,
      modelHealthAfter: context.modelHealthBefore,
    });
  }
  const converted = runtimeMapper.toLocalAiTaskRequest(request);
  if (converted.ok === false) {
    return rejectExecution(context, {
      implementationStatus: "task_type_mismatch",
      message: converted.message,
      errorKind: "task_type_mismatch",
      gatewayDurationMs: 0,
      modelHealthAfter: context.modelHealthBefore,
    });
  }

  state.activeRuns += 1;
  try {
    return await runConvertedRequest(gateway, state, context, converted.request);
  } finally {
    state.activeRuns = Math.max(0, state.activeRuns - 1);
  }
}

export type { AiRuntimeStructuredDebugEvent, LocalAiRuntimePortOptions } from "./local-ai-runtime-debug.js";