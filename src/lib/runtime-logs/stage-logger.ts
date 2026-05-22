import { RuntimeLogEventType } from "./event-types.js";
import type { RuntimeFailureClass, RuntimeRecoveryPolicy } from "./failure-classes.js";
import { createRuntimeEvent } from "./event-factory.js";
import type { RuntimeLogger } from "./logger.js";
import type { RuntimeLogMode } from "./schema.js";
import type { RuntimeTraceContext } from "./trace-context.js";
import { createChildTrace } from "./trace-context.js";

type RuntimeStageHandle = {
  stageName: string;
  startedAt: number;
  stepId?: string;
  complete(input?: {
    durationMs?: number;
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
    payload?: Record<string, unknown>;
  }): void;
  fail(input: {
    reason: string;
    failureClass: RuntimeFailureClass;
    durationMs?: number;
    retryable: boolean;
    terminal: boolean;
    recoveryPolicy: RuntimeRecoveryPolicy;
    actionableMessage?: string;
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
    payload?: Record<string, unknown>;
  }): void;
  skip(input: {
    reason: string;
    failureClass: RuntimeFailureClass;
    durationMs?: number;
    retryable?: boolean;
    terminal?: boolean;
    recoveryPolicy?: RuntimeRecoveryPolicy;
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
    payload?: Record<string, unknown>;
  }): void;
  reviewRequired(input: {
    reason: string;
    failureClass: RuntimeFailureClass;
    durationMs?: number;
    retryable?: boolean;
    terminal?: boolean;
    recoveryPolicy?: RuntimeRecoveryPolicy;
    actionableMessage?: string;
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
    payload?: Record<string, unknown>;
  }): void;
};

type RuntimeStageLogger = {
  start(input: {
    context: RuntimeTraceContext;
    stageName: string;
    stageAttempt?: number;
    modeVisibility?: RuntimeLogMode[];
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
    payload?: Record<string, unknown>;
  }): RuntimeStageHandle;
};

const DEFAULT_STAGE_VISIBILITY: RuntimeLogMode[] = ["DEBUG", "TRACE"];

const buildStagePayload = (input: {
  stageName: string;
  stageAttempt: number;
  failureClass?: RuntimeFailureClass;
  retryable?: boolean;
  terminal?: boolean;
  recoveryPolicy?: RuntimeRecoveryPolicy;
  payload?: Record<string, unknown>;
}): Record<string, unknown> => ({
  stageName: input.stageName,
  stageAttempt: input.stageAttempt,
  ...(input.failureClass ? { failureClass: input.failureClass } : {}),
  ...(input.retryable !== undefined ? { retryable: input.retryable } : {}),
  ...(input.terminal !== undefined ? { terminal: input.terminal } : {}),
  ...(input.recoveryPolicy ? { recoveryPolicy: input.recoveryPolicy } : {}),
  ...(input.payload ? input.payload : {}),
});

const emitTerminalStageEvent = (input: {
  logger: RuntimeLogger;
  context: RuntimeTraceContext;
  eventType: (typeof RuntimeLogEventType)[keyof typeof RuntimeLogEventType];
  level: "info" | "warn" | "error";
  stageName: string;
  stageAttempt: number;
  startedAt: number;
  durationMs?: number;
  status: "success" | "failed" | "review_required" | "skipped";
  reason?: string;
  actionableMessage?: string;
  failureClass?: RuntimeFailureClass;
  retryable?: boolean;
  terminal?: boolean;
  recoveryPolicy?: RuntimeRecoveryPolicy;
  modeVisibility: RuntimeLogMode[];
  preview?: Record<string, string>;
  refs?: Record<string, string>;
  hashes?: Record<string, string>;
  metrics?: Record<string, number>;
  payload?: Record<string, unknown>;
}): void => {
  input.logger.emit(createRuntimeEvent({
    context: input.context,
    eventType: input.eventType,
    level: input.level,
    modeVisibility: input.modeVisibility,
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.actionableMessage ? { actionableMessage: input.actionableMessage } : {}),
    ...(input.preview ? { preview: input.preview } : {}),
    ...(input.refs ? { refs: input.refs } : {}),
    ...(input.hashes ? { hashes: input.hashes } : {}),
    ...(input.metrics ? { metrics: input.metrics } : {}),
    payload: buildStagePayload({
      stageName: input.stageName,
      stageAttempt: input.stageAttempt,
      ...(input.failureClass ? { failureClass: input.failureClass } : {}),
      ...(input.retryable !== undefined ? { retryable: input.retryable } : {}),
      ...(input.terminal !== undefined ? { terminal: input.terminal } : {}),
      ...(input.recoveryPolicy ? { recoveryPolicy: input.recoveryPolicy } : {}),
      ...(input.payload ? { payload: input.payload } : {}),
    }),
    durationMs: input.durationMs ?? Date.now() - input.startedAt,
  }));
};

export const createStageLogger = (input: {
  logger: RuntimeLogger;
}): RuntimeStageLogger => ({
  start(stageInput) {
    const stageAttempt = stageInput.stageAttempt ?? 1;
    const stageContext = createChildTrace({
      context: stageInput.context,
      stepId: `${stageInput.stageName.toLowerCase()}-${stageAttempt}`,
    });
    const startedAt = Date.now();
    const modeVisibility = stageInput.modeVisibility ?? DEFAULT_STAGE_VISIBILITY;

    input.logger.emit(createRuntimeEvent({
      context: stageContext,
      eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED,
      level: "info",
      modeVisibility,
      status: "started",
      ...(stageInput.preview ? { preview: stageInput.preview } : {}),
      ...(stageInput.refs ? { refs: stageInput.refs } : {}),
      ...(stageInput.hashes ? { hashes: stageInput.hashes } : {}),
      ...(stageInput.metrics ? { metrics: stageInput.metrics } : {}),
      payload: buildStagePayload({
        stageName: stageInput.stageName,
        stageAttempt,
        ...(stageInput.payload ? { payload: stageInput.payload } : {}),
      }),
    }));

    return {
      stageName: stageInput.stageName,
      startedAt,
      ...(stageContext.stepId ? { stepId: stageContext.stepId } : {}),
      complete(completeInput) {
        emitTerminalStageEvent({
          logger: input.logger,
          context: stageContext,
          eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED,
          level: "info",
          stageName: stageInput.stageName,
          stageAttempt,
          startedAt,
          status: "success",
          modeVisibility,
          ...(completeInput?.durationMs !== undefined ? { durationMs: completeInput.durationMs } : {}),
          ...(completeInput?.preview ? { preview: completeInput.preview } : {}),
          ...(completeInput?.refs ? { refs: completeInput.refs } : {}),
          ...(completeInput?.hashes ? { hashes: completeInput.hashes } : {}),
          ...(completeInput?.metrics ? { metrics: completeInput.metrics } : {}),
          ...(completeInput?.payload ? { payload: completeInput.payload } : {}),
        });
      },
      fail(failInput) {
        emitTerminalStageEvent({
          logger: input.logger,
          context: stageContext,
          eventType: RuntimeLogEventType.RUNTIME_STAGE_FAILED,
          level: "error",
          stageName: stageInput.stageName,
          stageAttempt,
          startedAt,
          reason: failInput.reason,
          ...(failInput.actionableMessage ? { actionableMessage: failInput.actionableMessage } : {}),
          failureClass: failInput.failureClass,
          retryable: failInput.retryable,
          terminal: failInput.terminal,
          recoveryPolicy: failInput.recoveryPolicy,
          status: "failed",
          modeVisibility,
          ...(failInput.durationMs !== undefined ? { durationMs: failInput.durationMs } : {}),
          ...(failInput.preview ? { preview: failInput.preview } : {}),
          ...(failInput.refs ? { refs: failInput.refs } : {}),
          ...(failInput.hashes ? { hashes: failInput.hashes } : {}),
          ...(failInput.metrics ? { metrics: failInput.metrics } : {}),
          ...(failInput.payload ? { payload: failInput.payload } : {}),
        });
      },
      skip(skipInput) {
        emitTerminalStageEvent({
          logger: input.logger,
          context: stageContext,
          eventType: RuntimeLogEventType.RUNTIME_STAGE_SKIPPED,
          level: "warn",
          stageName: stageInput.stageName,
          stageAttempt,
          startedAt,
          reason: skipInput.reason,
          failureClass: skipInput.failureClass,
          retryable: skipInput.retryable ?? false,
          terminal: skipInput.terminal ?? false,
          recoveryPolicy: skipInput.recoveryPolicy ?? "skip_round",
          status: "skipped",
          modeVisibility,
          ...(skipInput.durationMs !== undefined ? { durationMs: skipInput.durationMs } : {}),
          ...(skipInput.preview ? { preview: skipInput.preview } : {}),
          ...(skipInput.refs ? { refs: skipInput.refs } : {}),
          ...(skipInput.hashes ? { hashes: skipInput.hashes } : {}),
          ...(skipInput.metrics ? { metrics: skipInput.metrics } : {}),
          ...(skipInput.payload ? { payload: skipInput.payload } : {}),
        });
      },
      reviewRequired(reviewInput) {
        emitTerminalStageEvent({
          logger: input.logger,
          context: stageContext,
          eventType: RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
          level: "warn",
          stageName: stageInput.stageName,
          stageAttempt,
          startedAt,
          reason: reviewInput.reason,
          ...(reviewInput.actionableMessage ? { actionableMessage: reviewInput.actionableMessage } : {}),
          failureClass: reviewInput.failureClass,
          retryable: reviewInput.retryable ?? false,
          terminal: reviewInput.terminal ?? true,
          recoveryPolicy: reviewInput.recoveryPolicy ?? "review_required",
          status: "review_required",
          modeVisibility,
          ...(reviewInput.durationMs !== undefined ? { durationMs: reviewInput.durationMs } : {}),
          ...(reviewInput.preview ? { preview: reviewInput.preview } : {}),
          ...(reviewInput.refs ? { refs: reviewInput.refs } : {}),
          ...(reviewInput.hashes ? { hashes: reviewInput.hashes } : {}),
          ...(reviewInput.metrics ? { metrics: reviewInput.metrics } : {}),
          ...(reviewInput.payload ? { payload: reviewInput.payload } : {}),
        });
      },
    };
  },
});
