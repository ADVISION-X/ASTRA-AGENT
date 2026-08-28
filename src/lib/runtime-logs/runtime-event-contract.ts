import type { RuntimeFailure, RuntimeLogOwner, RuntimeLogVisibility, RuntimeOperation, RuntimeSpanOutcome } from "./runtime-failure-contract.js";
import type { RuntimeTypedIdentity } from "./runtime-identity-contract.js";

type RuntimeEventCommon = Readonly<{
  schemaVersion: 2; eventId: string; occurredAt: string; producer: string; producerRunId: string;
  producerSeq: number; previousEventHash: `sha256:${string}` | null; eventHash: `sha256:${string}`;
  type: "SPAN" | "STATE"; traceId: string; owner: RuntimeLogOwner; component: string; visibility: RuntimeLogVisibility;
}>;
export type RuntimeSpanStartedEvent = RuntimeEventCommon & Readonly<{
  type: "SPAN"; phase: "started"; spanId: string; operation: RuntimeOperation; typedIdentity: RuntimeTypedIdentity;
  parentSpanId?: string; boundaryId?: string;
}>;
type RuntimeSpanTerminalCommon = RuntimeEventCommon & Readonly<{
  type: "SPAN"; phase: "terminal"; spanId: string; operation: RuntimeOperation; durationMs: number;
  authorityRef?: string; authorityHash?: `sha256:${string}`;
}>;
export type RuntimeSpanSuccessEvent = RuntimeSpanTerminalCommon & Readonly<{ outcome: "success"; failure?: never }>;
export type RuntimeSpanFailureEvent = RuntimeSpanTerminalCommon & Readonly<{ outcome: Exclude<RuntimeSpanOutcome, "success">; failure: RuntimeFailure }>;
export type RuntimeSpanTerminalEvent = RuntimeSpanSuccessEvent | RuntimeSpanFailureEvent;

type RuntimeStateDefinition =
  | Readonly<{ stateKey: "producer.lifecycle"; previous: "starting" | "ready" | "stopping" | "stopped" | "exit_detected" | null; current: "starting" | "ready" | "stopping" | "stopped" | "exit_detected" }>
  | Readonly<{ stateKey: "producer.alive"; previous: "alive" | null; current: "alive" }>
  | Readonly<{ stateKey: "log.sink"; previous: "ready" | "failed" | "capacity_blocked" | null; current: "ready" | "failed" | "capacity_blocked" }>
  | Readonly<{ stateKey: "website.core"; previous: "starting" | "ready" | "failed" | "stopped" | null; current: "starting" | "ready" | "failed" | "stopped" }>
  | Readonly<{ stateKey: "website.worker"; previous: "starting" | "ready" | "blocked" | "failed" | "stopped" | null; current: "starting" | "ready" | "blocked" | "failed" | "stopped" }>
  | Readonly<{ stateKey: "website.consume"; previous: "idle" | "pending" | "running" | "delivered" | "failed" | "review_required" | null; current: "idle" | "pending" | "running" | "delivered" | "failed" | "review_required" }>
  | Readonly<{ stateKey: "agent.shell"; previous: "starting" | "ready" | "failed" | "stopped" | null; current: "starting" | "ready" | "failed" | "stopped" }>
  | Readonly<{ stateKey: "cloud.contract"; previous: "ready" | "blocked" | null; current: "ready" | "blocked" }>
  | Readonly<{ stateKey: "cloud.session"; previous: "disconnected" | "connected" | "stale" | null; current: "disconnected" | "connected" | "stale" }>
  | Readonly<{ stateKey: "claim.admission"; previous: "eligible" | "blocked" | "draining" | null; current: "eligible" | "blocked" | "draining" }>
  | Readonly<{ stateKey: "browser.authority"; previous: "absent" | "present" | "stale" | null; current: "absent" | "present" | "stale" }>
  | Readonly<{ stateKey: "browser.target"; previous: "absent" | "claimed" | "drifted" | null; current: "absent" | "claimed" | "drifted" }>
  | Readonly<{ stateKey: "job.lifecycle"; previous: "accepted" | "running" | "recovery_pending" | "review_required" | "completed" | "failed" | null; current: "accepted" | "running" | "recovery_pending" | "review_required" | "completed" | "failed" }>
  | Readonly<{ stateKey: "job.lease"; previous: "absent" | "active" | "stale" | "lost" | null; current: "absent" | "active" | "stale" | "lost" }>
  | Readonly<{ stateKey: "job.checkpoint"; previous: "none" | "persisted" | "failed" | null; current: "none" | "persisted" | "failed" }>
  | Readonly<{ stateKey: "gpt.execution"; previous: "idle" | "running" | "failed" | "review_required" | null; current: "idle" | "running" | "failed" | "review_required" }>
  | Readonly<{ stateKey: "browser.execution"; previous: "idle" | "busy" | "failed" | "review_required" | null; current: "idle" | "busy" | "failed" | "review_required" }>
  | Readonly<{ stateKey: "browser.mutation"; previous: "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED" | null; current: "PREPARED" | "DISPATCHED" | "CONFIRMED" | "REJECTED" | "FAILED" }>
  | Readonly<{ stateKey: "outbox.delivery"; previous: "pending" | "delivered" | "failed" | null; current: "pending" | "delivered" | "failed" }>;

export type RuntimeStateKey = RuntimeStateDefinition["stateKey"];
export type RuntimeStateValue = RuntimeStateDefinition["current"];
export type RuntimeStateEvent = RuntimeEventCommon & RuntimeStateDefinition & Readonly<{
  type: "STATE"; freshForMs?: number; authorityRef?: string; authorityHash?: `sha256:${string}`; reconciledFromAuthority?: boolean;
}>;
export type RuntimeLogEventV2 = RuntimeSpanStartedEvent | RuntimeSpanTerminalEvent | RuntimeStateEvent;
export type RuntimeSpanStartInput = Readonly<{
  traceId: string; operation: RuntimeOperation; typedIdentity: RuntimeTypedIdentity; spanId?: string; parentSpanId?: string;
  boundaryId?: string; owner?: RuntimeLogOwner; component?: string; visibility?: RuntimeLogVisibility;
}>;
export type RuntimeSuccessfulTerminalInput = Readonly<{ outcome: "success"; authorityRef?: string; authorityHash?: `sha256:${string}` }>;
export type RuntimeFailedTerminalInput = Readonly<{
  outcome: Exclude<RuntimeSpanOutcome, "success">; failure: RuntimeFailure; authorityRef?: string; authorityHash?: `sha256:${string}`;
}>;
export type RuntimeSpanTerminalInput = RuntimeSuccessfulTerminalInput | RuntimeFailedTerminalInput;
export type RuntimeStateInput = Readonly<{
  traceId: string; owner?: RuntimeLogOwner; component?: string; visibility?: RuntimeLogVisibility; freshForMs?: number;
  authorityRef?: string; authorityHash?: `sha256:${string}`; reconciledFromAuthority?: boolean;
}> & RuntimeStateDefinition;
export type WithoutEventHash<T> = T extends unknown ? Omit<T, "eventHash"> : never;
export type RuntimeLogEventWithoutIntegrity = WithoutEventHash<RuntimeLogEventV2>;
export type RuntimeLogWriteFailure = Readonly<{
  ok: false; code: "RUNTIME_LOG_CAPACITY_BLOCKED" | "RUNTIME_LOG_SINK_WRITE_FAILED" | "DUPLICATE_SPAN_TERMINAL"; emergencyProjected: boolean;
}>;
export type RuntimeLogWriteResult<T> = Readonly<{ ok: true; event: T }> | RuntimeLogWriteFailure;
