import type {
  RuntimeFailure,
  RuntimeLogOwner,
  RuntimeLogVisibility,
  RuntimeOperation,
  RuntimeSpanOutcome,
} from "./runtime-failure-contract.js";
import type { RuntimeTypedIdentity } from "./runtime-identity-contract.js";

type RuntimeEventCommon = Readonly<{
  schemaVersion: 2;
  eventId: string;
  emittedAt: string;
  producer: string;
  producerRunId: string;
  producerSeq: number;
  previousEventHash: `sha256:${string}` | null;
  eventHash: `sha256:${string}`;
  kind: "event" | "span.started" | "span.terminal" | "error";
  traceId: string;
  owner: RuntimeLogOwner;
  component: string;
  operation: RuntimeOperation;
  visibility: RuntimeLogVisibility;
}>;

type RuntimeAuthorityReference = Readonly<{
  authorityRef?: string;
  authorityHash?: `sha256:${string}`;
  evidenceRef?: string;
  evidenceHash?: `sha256:${string}`;
}>;

export type RuntimeClaimDiagnostics = Readonly<{
  outcome: "LEASE_GRANTED" | "NO_ELIGIBLE_JOB" | "CAPACITY_ZERO" | "CLAIM_BLOCKED" | "DRAINING";
  claimed_count: number;
  reason_codes: readonly string[];
}>;

export type RuntimeObservedEvent = RuntimeEventCommon & RuntimeAuthorityReference & Readonly<{
  kind: "event";
  code: string;
  typedIdentity: RuntimeTypedIdentity;
}>;

export type RuntimeErrorEvent = RuntimeEventCommon & RuntimeAuthorityReference & Readonly<{
  kind: "error";
  failure: RuntimeFailure;
  typedIdentity: RuntimeTypedIdentity;
}>;

export type RuntimeSpanStartedEvent = RuntimeEventCommon & Readonly<{
  kind: "span.started";
  spanId: string;
  typedIdentity: RuntimeTypedIdentity;
  parentSpanId?: string;
  boundaryId?: string;
}>;

type RuntimeSpanTerminalCommon = RuntimeEventCommon & RuntimeAuthorityReference & Readonly<{
  kind: "span.terminal";
  spanId: string;
  durationMs: number;
  claimDiagnostics?: RuntimeClaimDiagnostics;
}>;

export type RuntimeSpanSuccessEvent = RuntimeSpanTerminalCommon & Readonly<{
  outcome: "succeeded";
  failure?: never;
}>;

export type RuntimeSpanFailureEvent = RuntimeSpanTerminalCommon & Readonly<{
  outcome: Exclude<RuntimeSpanOutcome, "succeeded">;
  failure: RuntimeFailure;
}>;

export type RuntimeSpanTerminalEvent = RuntimeSpanSuccessEvent | RuntimeSpanFailureEvent;
export type RuntimeLogEventV2 = RuntimeObservedEvent | RuntimeErrorEvent | RuntimeSpanStartedEvent | RuntimeSpanTerminalEvent;

type RuntimeWriteInputCommon = Readonly<{
  traceId: string;
  operation: RuntimeOperation;
  typedIdentity: RuntimeTypedIdentity;
  owner?: RuntimeLogOwner;
  component?: string;
  visibility?: RuntimeLogVisibility;
}>;

export type RuntimeEventInput = RuntimeWriteInputCommon & RuntimeAuthorityReference & Readonly<{ code: string }>;
export type RuntimeErrorInput = RuntimeWriteInputCommon & RuntimeAuthorityReference & Readonly<{ failure: RuntimeFailure }>;

export type RuntimeSpanStartInput = RuntimeWriteInputCommon & Readonly<{
  spanId?: string;
  parentSpanId?: string;
  boundaryId?: string;
}>;

export type RuntimeSuccessfulTerminalInput = RuntimeAuthorityReference & Readonly<{
  outcome: "succeeded";
  claimDiagnostics?: RuntimeClaimDiagnostics;
}>;
export type RuntimeFailedTerminalInput = RuntimeAuthorityReference & Readonly<{
  outcome: Exclude<RuntimeSpanOutcome, "succeeded">;
  failure: RuntimeFailure;
  claimDiagnostics?: RuntimeClaimDiagnostics;
}>;
export type RuntimeSpanTerminalInput = RuntimeSuccessfulTerminalInput | RuntimeFailedTerminalInput;

export type WithoutEventHash<T> = T extends unknown ? Omit<T, "eventHash"> : never;
export type RuntimeLogEventWithoutIntegrity = WithoutEventHash<RuntimeLogEventV2>;
export type RuntimeLogWriteFailure = Readonly<{
  ok: false;
  code: "RUNTIME_LOG_CAPACITY_BLOCKED" | "RUNTIME_LOG_SINK_WRITE_FAILED" | "DUPLICATE_SPAN_TERMINAL";
  emergencyProjected: boolean;
}>;
export type RuntimeLogWriteResult<T> = Readonly<{ ok: true; event: T }> | RuntimeLogWriteFailure;
