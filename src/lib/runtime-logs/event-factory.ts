import type { RuntimeLogEventType } from "./event-types.js";
import type { RuntimeLogEventInput, RuntimeLogLevel, RuntimeLogMode, RuntimeLogStatus } from "./schema.js";
import type { RuntimeTraceContext } from "./trace-context.js";

type CreateRuntimeEventInput = {
  context: RuntimeTraceContext;
  eventType: RuntimeLogEventType;
  level: RuntimeLogLevel;
  modeVisibility: RuntimeLogMode[];
  status?: RuntimeLogStatus;
  reason?: string;
  actionableMessage?: string;
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
  hashes?: Record<string, string>;
  preview?: Record<string, string>;
  payload?: Record<string, unknown>;
  durationMs?: number;
  capabilityCallId?: string;
};

const createTraceFields = (context: RuntimeTraceContext) => ({
  traceId: context.traceId,
  spanId: context.spanId,
  ...(context.parentSpanId ? { parentSpanId: context.parentSpanId } : {}),
  ...(context.missionId ? { missionId: context.missionId } : {}),
  ...(context.runId ? { runId: context.runId } : {}),
  ...(context.roundId ? { roundId: context.roundId } : {}),
  ...(context.stepId ? { stepId: context.stepId } : {}),
  owner: context.owner,
});

const createOptionalEventFields = (input: CreateRuntimeEventInput) => ({
  ...(input.status ? { status: input.status } : {}),
  ...(input.reason ? { reason: input.reason } : {}),
  ...(input.actionableMessage ? { actionableMessage: input.actionableMessage } : {}),
  ...(input.refs ? { refs: input.refs } : {}),
  ...(input.metrics ? { metrics: input.metrics } : {}),
  ...(input.hashes ? { hashes: input.hashes } : {}),
  ...(input.preview ? { preview: input.preview } : {}),
  ...(input.payload ? { payload: input.payload } : {}),
  ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
  ...(input.capabilityCallId ? { capabilityCallId: input.capabilityCallId } : {}),
});

export const createRuntimeEvent = (input: CreateRuntimeEventInput): RuntimeLogEventInput => ({
  ...createTraceFields(input.context),
  level: input.level,
  modeVisibility: input.modeVisibility,
  eventType: input.eventType,
  ...createOptionalEventFields(input),
});
