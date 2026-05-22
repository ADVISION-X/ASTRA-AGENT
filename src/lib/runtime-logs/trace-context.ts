import { randomUUID } from "node:crypto";

import type { RuntimeLogOwner } from "./schema.js";

export type RuntimeTraceContext = {
  traceId: string;
  missionId?: string;
  runId?: string;
  roundId?: string;
  stepId?: string;
  spanId: string;
  parentSpanId?: string;
  owner: RuntimeLogOwner;
};

export const createMissionTrace = (input: {
  missionId: string;
  runId: string;
  owner: RuntimeLogOwner;
}): RuntimeTraceContext => ({
  traceId: input.runId,
  missionId: input.missionId,
  runId: input.runId,
  spanId: randomUUID(),
  owner: input.owner,
});

export const withRoundTrace = (input: {
  context: RuntimeTraceContext;
  roundId: string;
}): RuntimeTraceContext => ({
  ...input.context,
  roundId: input.roundId,
});

export const createChildTrace = (input: {
  context: RuntimeTraceContext;
  stepId?: string;
  owner?: RuntimeLogOwner;
}): RuntimeTraceContext => ({
  ...input.context,
  stepId: input.stepId ?? input.context.stepId,
  parentSpanId: input.context.spanId,
  spanId: randomUUID(),
  owner: input.owner ?? input.context.owner,
});