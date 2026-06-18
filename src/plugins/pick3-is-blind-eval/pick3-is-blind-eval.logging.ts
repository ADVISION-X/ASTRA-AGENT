import {
  RuntimeFailureClass,
  RuntimeLogEventType,
  createMissionTrace,
  createRuntimeEvent,
  type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";

export type Pick3FlowLog = {
  logger: RuntimeLogger;
  taskId: string;
};

export type Pick3StageLog = {
  flowLog: Pick3FlowLog;
  stageName: string;
  startedAt: number;
};

export const createPick3FlowLogger = (input: {
  runtimeLogger?: RuntimeLogger | undefined;
  taskId: string;
}): Pick3FlowLog | null => input.runtimeLogger
  ? {
      logger: input.runtimeLogger,
      taskId: input.taskId,
    }
  : null;

export const classifyPick3Failure = (reason: string): RuntimeFailureClass => {
  if (reason.includes("prompt_exchange") || reason.includes("prediction_json") || reason.includes("provider_")) {
    return RuntimeFailureClass.AI_PARSE_FAILURE;
  }
  if (reason.includes("official") || reason.includes("full_history") || reason.includes("not_enough_history")) {
    return RuntimeFailureClass.SCHEMA_CONTRACT_VIOLATION;
  }
  return RuntimeFailureClass.INTERNAL_BUG;
};

const traceFor = (flowLog: Pick3FlowLog) => createMissionTrace({
  missionId: flowLog.taskId,
  runId: flowLog.taskId,
  owner: "pick3-is-blind-eval",
});

export const startPick3Stage = (input: {
  flowLog: Pick3FlowLog | null;
  stageName: string;
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
  preview?: Record<string, string>;
}): Pick3StageLog | null => {
  if (!input.flowLog) return null;
  const refs = {
    taskId: input.flowLog.taskId,
    stageName: input.stageName,
    ...input.refs,
  };
  input.flowLog.logger.emit(createRuntimeEvent({
    context: traceFor(input.flowLog),
    eventType: RuntimeLogEventType.RUNTIME_STAGE_STARTED,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    status: "started",
    refs,
    metrics: input.metrics ?? {},
    preview: input.preview ?? {},
    payload: {
      stageName: input.stageName,
      stageAttempt: 1,
    },
  }));
  return {
    flowLog: input.flowLog,
    stageName: input.stageName,
    startedAt: Date.now(),
  };
};

export const completePick3Stage = (input: {
  stage: Pick3StageLog | null;
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
}): void => {
  if (!input.stage) return;
  const refs = {
    taskId: input.stage.flowLog.taskId,
    stageName: input.stage.stageName,
    ...input.refs,
  };
  input.stage.flowLog.logger.emit(createRuntimeEvent({
    context: traceFor(input.stage.flowLog),
    eventType: RuntimeLogEventType.RUNTIME_STAGE_COMPLETED,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    status: "success",
    refs,
    metrics: input.metrics ?? {},
    payload: {
      stageName: input.stage.stageName,
      stageAttempt: 1,
    },
    durationMs: Date.now() - input.stage.startedAt,
  }));
};

export const reviewRequiredPick3Stage = (input: {
  stage: Pick3StageLog | null;
  reason: string;
  refs?: Record<string, string>;
}): void => {
  if (!input.stage) return;
  const failureClass = classifyPick3Failure(input.reason);
  const refs = {
    taskId: input.stage.flowLog.taskId,
    stageName: input.stage.stageName,
    ...input.refs,
  };
  input.stage.flowLog.logger.emit(createRuntimeEvent({
    context: traceFor(input.stage.flowLog),
    eventType: RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
    level: "warn",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    status: "review_required",
    reason: input.reason,
    refs,
    payload: {
      stageName: input.stage.stageName,
      stageAttempt: 1,
      failureClass,
      retryable: false,
      terminal: true,
      recoveryPolicy: "review_required",
    },
    durationMs: Date.now() - input.stage.startedAt,
  }));
};

export const runPick3LoggedStage = async <T>(input: {
  flowLog: Pick3FlowLog | null;
  stageName: string;
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
  preview?: Record<string, string>;
  run: () => Promise<T>;
  complete?: (value: T) => { refs?: Record<string, string>; metrics?: Record<string, number> };
}): Promise<T> => {
  const stage = startPick3Stage(input);
  try {
    const value = await input.run();
    completePick3Stage({ stage, ...(input.complete?.(value) ?? {}) });
    return value;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const failureClass = classifyPick3Failure(reason);
    stage?.flowLog.logger.emit(createRuntimeEvent({
      context: traceFor(stage.flowLog),
      eventType: RuntimeLogEventType.RUNTIME_STAGE_REVIEW_REQUIRED,
      level: "warn",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      status: "review_required",
      reason,
      refs: { taskId: stage.flowLog.taskId, stageName: stage.stageName, ...(input.refs ?? {}) },
      payload: { stageName: stage.stageName, stageAttempt: 1, failureClass, retryable: false, terminal: true, recoveryPolicy: "review_required" },
      durationMs: Date.now() - stage.startedAt,
    }));
    throw error;
  }
};
