// Runtime Log Spine — Trace
// Lightweight trace/span context. Not a vendor SDK. No network calls.

import { randomUUID } from "node:crypto";

export type TraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  missionId?: string;
  runId?: string;
  sessionId?: string;
};

export type CreateTraceContextInput = {
  missionId?: string;
  runId?: string;
  sessionId?: string;
  parentSpanId?: string;
};

/** Create a new root trace context. */
export function createTraceContext(input: CreateTraceContextInput = {}): TraceContext {
  return {
    traceId: randomUUID(),
    spanId: randomUUID(),
    ...(input.parentSpanId ? { parentSpanId: input.parentSpanId } : {}),
    ...(input.missionId ? { missionId: input.missionId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  };
}

/** Fork a child span from an existing trace context. */
export function forkSpan(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: randomUUID(),
    parentSpanId: parent.spanId,
    ...(parent.missionId ? { missionId: parent.missionId } : {}),
    ...(parent.runId ? { runId: parent.runId } : {}),
    ...(parent.sessionId ? { sessionId: parent.sessionId } : {}),
  };
}

/** Execute fn inside a child span. Span timing is provided via startedAt/endedAt. */
export async function withRuntimeSpan<T>(
  parent: TraceContext,
  fn: (span: TraceContext) => Promise<T>,
): Promise<T> {
  const span = forkSpan(parent);
  return fn(span);
}
