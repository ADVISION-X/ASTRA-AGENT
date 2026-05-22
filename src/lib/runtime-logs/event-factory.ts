import type { RuntimeLogEventType } from "./event-types.js";
import type { RuntimeLogEventInput, RuntimeLogLevel, RuntimeLogMode, RuntimeLogStatus } from "./schema.js";
import type { RuntimeTraceContext } from "./trace-context.js";

export const createRuntimeEvent = (input: {
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
}): RuntimeLogEventInput => ({
  traceId: input.context.traceId,
  spanId: input.context.spanId,
  ...(input.context.parentSpanId ? { parentSpanId: input.context.parentSpanId } : {}),
  ...(input.context.missionId ? { missionId: input.context.missionId } : {}),
  ...(input.context.runId ? { runId: input.context.runId } : {}),
  ...(input.context.roundId ? { roundId: input.context.roundId } : {}),
  ...(input.context.stepId ? { stepId: input.context.stepId } : {}),
  level: input.level,
  modeVisibility: input.modeVisibility,
  eventType: input.eventType,
  owner: input.context.owner,
  ...(input.status ? { status: input.status } : {}),
  ...(input.reason ? { reason: input.reason } : {}),
  ...(input.actionableMessage ? { actionableMessage: input.actionableMessage } : {}),
  ...(input.refs ? { refs: input.refs } : {}),
  ...(input.metrics ? { metrics: input.metrics } : {}),
  ...(input.hashes ? { hashes: input.hashes } : {}),
  ...(input.preview ? { preview: input.preview } : {}),
  ...(input.payload ? { payload: input.payload } : {}),
  ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
});
