import {
  RuntimeLogEventType,
  createRuntimeEvent,
  createMissionTrace,
  type RuntimeFailureClass,
  type RuntimeLogger,
  type RuntimeTraceContext,
} from "../../lib/runtime-logs/index.js";
import type {
  DeepResearchPhase,
} from "./deep-research-analysis.schema.js";

const DEEP_RESEARCH_RUNTIME_LOG_OWNER = "deep-research-analysis" as const;

type DeepResearchLogStatus = "started" | "success" | "failed" | "review_required";

const emitDeepResearchEvent = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  eventType: typeof RuntimeLogEventType[keyof typeof RuntimeLogEventType];
  level: "info" | "warn" | "error";
  status: DeepResearchLogStatus;
  phase: DeepResearchPhase;
  reason?: string;
  refs?: Record<string, string>;
  hashes?: Record<string, string>;
  metrics?: Record<string, number>;
  preview?: Record<string, string>;
  payload?: Record<string, unknown>;
}): void => {
  input.logger.emit(createRuntimeEvent({
    context: input.traceContext,
    eventType: input.eventType,
    level: input.level,
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.refs ? { refs: input.refs } : {}),
    ...(input.hashes ? { hashes: input.hashes } : {}),
    ...(input.metrics ? { metrics: input.metrics } : {}),
    ...(input.preview ? { preview: input.preview } : {}),
    payload: {
      phase: input.phase,
      ...(input.payload ? input.payload : {}),
    },
  }));
};

export const createDeepResearchTraceContext = (jobId: string): RuntimeTraceContext =>
  createMissionTrace({
    missionId: jobId,
    runId: jobId,
    owner: DEEP_RESEARCH_RUNTIME_LOG_OWNER,
  });

export const logDeepResearchJobStarted = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  inputHash: string;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_JOB_STARTED,
    level: "info",
    status: "started",
    phase: input.phase,
    hashes: { inputHash: input.inputHash },
  });
};

export const logDeepResearchPromptSent = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  subQuestionId?: string;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_PROMPT_SENT,
    level: "info",
    status: "success",
    phase: input.phase,
    hashes: { promptHash: input.promptHash },
    preview: {
      promptId: input.promptId,
      promptVersion: input.promptVersion,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    },
  });
};

export const logDeepResearchDomCaptureStarted = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  promptHash: string;
  subQuestionId?: string;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_DOM_CAPTURE_STARTED,
    level: "info",
    status: "started",
    phase: input.phase,
    hashes: { promptHash: input.promptHash },
    ...(input.subQuestionId ? { preview: { subQuestionId: input.subQuestionId } } : {}),
  });
};

export const logDeepResearchDomCaptureCompleted = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  promptHash: string;
  rawResponseHash: string;
  domRef: string;
  subQuestionId?: string;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_DOM_CAPTURE_COMPLETED,
    level: "info",
    status: "success",
    phase: input.phase,
    refs: { domRef: input.domRef },
    hashes: {
      promptHash: input.promptHash,
      rawResponseHash: input.rawResponseHash,
    },
    ...(input.subQuestionId ? { preview: { subQuestionId: input.subQuestionId } } : {}),
  });
};

export const logDeepResearchParseCompleted = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  rawResponseHash: string;
  parseStatus: string;
  recordCount: number;
  subQuestionId?: string;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_PARSE_COMPLETED,
    level: "info",
    status: "success",
    phase: input.phase,
    hashes: { rawResponseHash: input.rawResponseHash },
    metrics: { recordCount: input.recordCount },
    preview: {
      parseStatus: input.parseStatus,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    },
  });
};

export const logDeepResearchParseFailed = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  rawResponseHash: string;
  reason: string;
  failureClass: RuntimeFailureClass;
  parseStatus: string;
  subQuestionId?: string;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_PARSE_FAILED,
    level: "warn",
    status: input.parseStatus === "partial_review_required" ? "review_required" : "failed",
    phase: input.phase,
    reason: input.reason,
    hashes: { rawResponseHash: input.rawResponseHash },
    preview: {
      parseStatus: input.parseStatus,
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    },
    payload: { failureClass: input.failureClass },
  });
};

export const logDeepResearchRecordPersisted = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  recordType: string;
  recordId: string;
  recordIds?: string[];
  count?: number;
  subQuestionId?: string;
  promptHash?: string;
  rawResponseHash?: string;
}): void => {
  const recordCount = input.count ?? input.recordIds?.length;
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_RECORD_PERSISTED,
    level: "info",
    status: "success",
    phase: input.phase,
    hashes: {
      ...(input.promptHash ? { promptHash: input.promptHash } : {}),
      ...(input.rawResponseHash ? { rawResponseHash: input.rawResponseHash } : {}),
    },
    ...(recordCount !== undefined ? { metrics: { recordCount } } : {}),
    preview: {
      recordType: input.recordType,
      recordId: input.recordId,
      firstRecordId: input.recordIds?.[0] ?? input.recordId,
      ...(recordCount !== undefined ? { recordCount: String(recordCount) } : {}),
      ...(input.recordIds && input.recordIds.length > 1
        ? { recordIds: input.recordIds.join(",") }
        : {}),
      ...(input.subQuestionId ? { subQuestionId: input.subQuestionId } : {}),
    },
  });
};

export const logDeepResearchStructuredIndexBuilt = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  packageHash: string;
  recordHashCount: number;
  promptVersionCount: number;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_FINAL_PACKAGE_BUILT,
    level: "info",
    status: "success",
    phase: input.phase,
    hashes: { packageHash: input.packageHash },
    metrics: {
      recordHashCount: input.recordHashCount,
      promptVersionCount: input.promptVersionCount,
    },
  });
};

export const logDeepResearchExportCompleted = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  exportDir: string;
  finalReportHash: string;
  fullCaseFileJsonHash?: string;
  fullCaseFileMarkdownHash?: string;
  decisionPackageHash: string;
  evidenceIndexHash: string;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_EXPORT_COMPLETED,
    level: "info",
    status: "success",
    phase: input.phase,
    refs: { exportDir: input.exportDir },
    hashes: {
      finalReportHash: input.finalReportHash,
      ...(input.fullCaseFileJsonHash ? { fullCaseFileJsonHash: input.fullCaseFileJsonHash } : {}),
      ...(input.fullCaseFileMarkdownHash ? { fullCaseFileMarkdownHash: input.fullCaseFileMarkdownHash } : {}),
      decisionPackageHash: input.decisionPackageHash,
      evidenceIndexHash: input.evidenceIndexHash,
    },
  });
};

export const logDeepResearchJobCompleted = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  reportHash: string;
  recordHashCount: number;
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_JOB_COMPLETED,
    level: "info",
    status: "success",
    phase: input.phase,
    hashes: { reportHash: input.reportHash },
    metrics: { recordHashCount: input.recordHashCount },
  });
};

export const logDeepResearchJobFailed = (input: {
  logger: RuntimeLogger;
  traceContext: RuntimeTraceContext;
  phase: DeepResearchPhase;
  reason: string;
  failureClass: RuntimeFailureClass;
  status?: "failed" | "review_required";
}): void => {
  emitDeepResearchEvent({
    logger: input.logger,
    traceContext: input.traceContext,
    eventType: RuntimeLogEventType.DEEP_RESEARCH_JOB_FAILED,
    level: input.status === "review_required" ? "warn" : "error",
    status: input.status ?? "failed",
    phase: input.phase,
    reason: input.reason,
    payload: { failureClass: input.failureClass },
  });
};
