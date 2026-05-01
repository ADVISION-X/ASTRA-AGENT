import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";
import { isLocalAiRuntimeError } from "../../../lib/local-ai/local-ai-runtime-error.js";
import type { LocalAiTaskRequest, LocalAiTaskResult } from "../../../types/local-ai.js";
import type { AiRuntimeExecutionOutput } from "../contract.js";
import type { AiRuntimePort } from "../ports/ai-runtime-port.js";
import * as runtimeContext from "./local-ai-runtime-context-support.js";
import * as runtimeDebug from "./local-ai-runtime-debug.js";
import { hashValue } from "./local-ai-runtime-debug-state.js";
import { executeWithTimeout, type ProtectedGatewayResult } from "./local-ai-runtime-gateway.js";
import * as runtimeMapper from "./local-ai-runtime-mapper.js";
import * as runtimeOutput from "./local-ai-runtime-output.js";

const MAX_CONCURRENT_RUNS = 1;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000;

type CircuitBreaker = {
  failureCount: number;
  openedAtMs: number | null;
};

type ExecuteRequest = Parameters<AiRuntimePort["execute"]>[0];
type LocalAiExecutionContext = {
  request: ExecuteRequest;
  identity: ReturnType<typeof runtimeContext.buildAiRuntimeCallIdentity>;
  timeoutMs: number;
  rawOutputRef: string;
  modelHealthBefore: string;
  circuitBreakerState: runtimeOutput.LocalAiCircuitBreakerState;
  debugSession: ReturnType<typeof runtimeDebug.createLocalAiDebugSession>;
};

const circuitBreaker: CircuitBreaker = {
  failureCount: 0,
  openedAtMs: null,
};

let activeRuns = 0;

function getCircuitBreakerState(nowMs: number): runtimeOutput.LocalAiCircuitBreakerState {
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

export function createLocalAiRuntimePort(options: runtimeDebug.LocalAiRuntimePortOptions = {}): AiRuntimePort {
  const gateway = new LocalAiGateway();
  return {
    execute: (request) => executeLocalAiRuntimeRequest(gateway, request, options),
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
  request: ExecuteRequest,
  options: runtimeDebug.LocalAiRuntimePortOptions,
): Promise<LocalAiExecutionContext> {
  const identity = runtimeContext.buildAiRuntimeCallIdentity(request);
  const rawOutputRef = runtimeContext.buildStableAiRef("ai-raw-output", [request.sessionId, request.taskType, request.roundId, identity.requestHash.slice(0, 16)]);
  const promptDebugRef = runtimeContext.buildStableAiRef("ai-prompt-debug", [request.sessionId, request.taskType, request.roundId, identity.requestHash.slice(0, 16)]);
  return {
    request,
    identity,
    timeoutMs: runtimeContext.resolveAiTimeoutPolicy(request).timeoutMs,
    rawOutputRef,
    modelHealthBefore: runtimeMapper.describeHealth(runtimeMapper.toAiRuntimeHealth(await gateway.getRuntimeHealth())),
    circuitBreakerState: getCircuitBreakerState(performance.now()),
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
  context: LocalAiExecutionContext,
  localRequest: LocalAiTaskRequest,
): Promise<AiRuntimeExecutionOutput> {
  try {
    const protectedResult = await executeWithTimeout<LocalAiTaskResult>({
      execute: async () => gateway.execute(localRequest),
      timeoutMs: context.timeoutMs,
    });
    if (protectedResult.ok === false) {
      return handleProtectedFailure(gateway, context, protectedResult);
    }
    return handleProtectedSuccess(gateway, context, protectedResult);
  } catch (error) {
    recordCircuitFailure(performance.now());
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
  context: LocalAiExecutionContext,
  protectedResult: ProtectedGatewayResult<LocalAiTaskResult> & { ok: false },
): Promise<AiRuntimeExecutionOutput> {
  recordCircuitFailure(performance.now());
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
  context: LocalAiExecutionContext,
  protectedResult: ProtectedGatewayResult<LocalAiTaskResult> & { ok: true },
): Promise<AiRuntimeExecutionOutput> {
  recordCircuitSuccess();
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
    circuitBreakerState: getCircuitBreakerState(performance.now()),
    gatewayDurationMs: protectedResult.gatewayDurationMs,
    modelHealthBefore: context.modelHealthBefore,
    modelHealthAfter,
  });
}

async function executeLocalAiRuntimeRequest(
  gateway: LocalAiGateway,
  request: ExecuteRequest,
  options: runtimeDebug.LocalAiRuntimePortOptions,
): Promise<AiRuntimeExecutionOutput> {
  const context = await createExecutionContext(gateway, request, options);
  if (context.circuitBreakerState === "open") {
    return rejectExecution(context, {
      implementationStatus: "circuit_breaker_open",
      message: "Local AI circuit breaker is open.",
      errorKind: "circuit_breaker_open",
      gatewayDurationMs: 0,
      modelHealthAfter: context.modelHealthBefore,
    });
  }
  if (activeRuns >= MAX_CONCURRENT_RUNS) {
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

  activeRuns += 1;
  try {
    return await runConvertedRequest(gateway, context, converted.request);
  } finally {
    activeRuns = Math.max(0, activeRuns - 1);
  }
}

export type { AiRuntimeStructuredDebugEvent, LocalAiRuntimePortOptions } from "./local-ai-runtime-debug.js";