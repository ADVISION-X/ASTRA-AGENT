export type RuntimeAuthorityResolver = (
  authorityRef: string,
  authorityHash: `sha256:${string}`,
) => "verified" | "missing" | "mismatch";

export type DiagnosedFailure = Readonly<{
  eventId: string;
  eventRefs: readonly string[];
  operation: string;
  owner: string;
  responsibleOwner: string;
  kind: string;
  code: string;
  nativeCause: string | null;
  httpStatus: number | null;
  impact: string;
  causedByEventId: string | null;
  authorityRef: string | null;
  evidenceRef: string | null;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
}>;

export type RuntimeDiagnosisScope = Readonly<{
  status: "SELECTED" | "NO_ACTIVE_SCOPE" | "AMBIGUOUS_SCOPE" | "SOURCE_UNAVAILABLE";
  selectedTraceId: string | null;
  candidates: readonly string[];
  completeness: "COMPLETE" | "DIAGNOSIS_INCOMPLETE";
}>;

export type RuntimeDiagnosis = Readonly<{
  status: "DIAGNOSIS_COMPLETE" | "DIAGNOSIS_INCOMPLETE";
  traceId: string;
  sources: readonly Readonly<{ source: string; available: boolean; files: number; events: number }> [];
  lastSuccessfulActions: readonly Readonly<{
    producerRunId: string;
    operation: string;
    owner: string;
    eventId: string;
  }>[];
  observedEvents: readonly Readonly<{
    code: string;
    operation: string;
    owner: string;
    eventId: string;
    authorityRef: string | null;
    authorityHash: string | null;
  }>[];
  openSpans: readonly string[];
  interruptedSpans: readonly string[];
  blockingRoots: readonly DiagnosedFailure[];
  consequentialFailures: readonly DiagnosedFailure[];
  cleanupFailures: readonly DiagnosedFailure[];
  authorityRefs: readonly string[];
  warnings: readonly string[];
  findings: readonly string[];
  atomicSteps: readonly Readonly<{
    pluginStepId: string;
    childCapabilityId: string;
    actionOrdinal: number;
    commandId: string;
    capabilityId: string | null;
    precondition: "passed" | "failed" | "not_applicable";
    dispatch: "dispatched" | "not_dispatched" | "not_applicable";
    postcondition: "passed" | "failed" | "pending_reconciliation" | "not_reached" | "not_applicable";
    observedOutcome: string;
    failureCode: string | null;
    authorityRef: string | null;
    authorityHash: string | null;
    startedEventId: string;
    terminalEventId: string | null;
  }>[];
}>;
