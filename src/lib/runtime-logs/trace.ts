export type TraceContext = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  missionId?: string;
  runId?: string;
  sessionId?: string;
};

