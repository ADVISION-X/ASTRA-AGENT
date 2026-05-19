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
