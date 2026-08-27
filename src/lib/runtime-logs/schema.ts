export const RuntimeFailureKind = {
  TRANSPORT: "transport",
  AUTHENTICATION: "authentication",
  CONTRACT: "contract",
  ADMISSION: "admission",
  DEPENDENCY: "dependency",
  STORAGE: "storage",
  BROWSER: "browser",
  PROVIDER: "provider",
  INTERNAL: "internal",
} as const;

export const RuntimeRecovery = {
  RETRY: "retry",
  BACKOFF: "backoff",
  DRAIN: "drain",
  REVIEW: "review",
  STOP: "stop",
  NONE: "none",
} as const;

export const RuntimeFailureImpact = {
  BLOCKING: "BLOCKING",
  CONSEQUENTIAL: "CONSEQUENTIAL",
  CLEANUP: "CLEANUP",
} as const;

export type RuntimeFailureKind = (typeof RuntimeFailureKind)[keyof typeof RuntimeFailureKind];
export type RuntimeRecovery = (typeof RuntimeRecovery)[keyof typeof RuntimeRecovery];
export type RuntimeFailureImpact = (typeof RuntimeFailureImpact)[keyof typeof RuntimeFailureImpact];

export type RuntimeLogOwner =
  | "website"
  | "startup-entrypoint"
  | "app-shell"
  | "production-runtime"
  | "mediator"
  | "product-plugin"
  | "gpt"
  | "browser-session"
  | "forensics-persistence"
  | "runtime-logs"
  | "outbox";

export type RuntimeLogVisibility = "FLOW" | "DEBUG" | "TRACE";
export type RuntimeSpanOutcome = "success" | "failed" | "review_required" | "skipped";

export type RuntimeOperation =
  | "api.boundary"
  | "browser.command"
  | "browser.infrastructure"
  | "cloud.claim"
  | "cloud.session-open"
  | "forensics.append-artifact"
  | "forensics.append-record"
  | "gpt.child"
  | "job.durable-accept"
  | "job.execute"
  | "job.checkpoint"
  | "job.lease-release"
  | "job.lease-renew"
  | "job.terminal"
  | "material.download-verify"
  | "mediator.dispatch"
  | "outbox.flush"
  | "plugin.execute"
  | "result.upload"
  | "runtime.shutdown"
  | "runtime.start"
  | "startup.step"
  | "website.first-terminal"
  | "website.outbox"
  | "website.result-consume"
  | "website.task-create"
  | "website.v6-request";

export type RuntimeProducerIdentity = Readonly<{ kind: "producer"; producerId: string }>;
export type RuntimeRequestIdentity = Readonly<{ kind: "request"; requestId: string; jobId?: string }>;
export type RuntimeJobIdentity = Readonly<{ kind: "job"; jobId: string }>;
export type RuntimeJobAttemptIdentity = Readonly<{ kind: "job-attempt"; jobId: string; attemptId: string }>;
export type RuntimeLeaseIdentity = Readonly<{
  kind: "lease";
  jobId: string;
  attemptId: string;
  leaseVersion: number;
  fenceHash: string;
}>;
export type RuntimePluginStepIdentity = Readonly<{
  kind: "plugin-step";
  jobId: string;
  attemptId: string;
  pluginId: string;
  stepId: string;
}>;
export type RuntimeGptCallIdentity = Readonly<{
  kind: "gpt-call";
  jobId: string;
  attemptId: string;
  pluginId: string;
  stepId: string;
  capabilityCallId: string;
}>;
export type RuntimeBrowserCommandIdentity = Readonly<{
  kind: "browser-command";
  jobId: string;
  attemptId: string;
  leaseVersion: number;
  fenceHash: string;
  pluginId: string;
  commandId: string;
  capabilityCallId?: string;
}>;
export type RuntimeBrowserMutationIdentity = Readonly<{
  kind: "browser-mutation";
  jobId: string;
  attemptId: string;
  commandId: string;
}>;
export type RuntimeCheckpointIdentity = Readonly<{
  kind: "checkpoint";
  jobId: string;
  attemptId: string;
  checkpointId: string;
}>;
export type RuntimeOutboxIdentity = Readonly<{ kind: "outbox"; jobId: string; outboxId: string }>;

export type RuntimeTypedIdentity =
  | RuntimeProducerIdentity
  | RuntimeRequestIdentity
  | RuntimeJobIdentity
  | RuntimeJobAttemptIdentity
  | RuntimeLeaseIdentity
  | RuntimePluginStepIdentity
  | RuntimeGptCallIdentity
  | RuntimeBrowserCommandIdentity
  | RuntimeBrowserMutationIdentity
  | RuntimeCheckpointIdentity
  | RuntimeOutboxIdentity;

export type RuntimeFailure = Readonly<{
  kind: RuntimeFailureKind;
  code: string;
  responsibleOwner: RuntimeLogOwner;
  impact: RuntimeFailureImpact;
  recovery: RuntimeRecovery;
  nativeCause?: string;
  causedByEventId?: string;
  httpStatus?: number;
}>;

type RuntimeEventCommon = Readonly<{
  schemaVersion: 2;
  eventId: string;
  occurredAt: string;
  producer: string;
  producerRunId: string;
  producerSeq: number;
  previousEventHash: `sha256:${string}` | null;
  eventHash: `sha256:${string}`;
  type: "SPAN" | "STATE";
  traceId: string;
  owner: RuntimeLogOwner;
  component: string;
  visibility: RuntimeLogVisibility;
}>;

export type RuntimeSpanStartedEvent = RuntimeEventCommon & Readonly<{
  type: "SPAN";
  phase: "started";
  spanId: string;
  operation: RuntimeOperation;
  typedIdentity: RuntimeTypedIdentity;
  parentSpanId?: string;
  boundaryId?: string;
}>;

type RuntimeSpanTerminalCommon = RuntimeEventCommon & Readonly<{
  type: "SPAN";
  phase: "terminal";
  spanId: string;
  operation: RuntimeOperation;
  durationMs: number;
  authorityRef?: string;
  authorityHash?: `sha256:${string}`;
}>;

export type RuntimeSpanSuccessEvent = RuntimeSpanTerminalCommon & Readonly<{
  outcome: "success";
  failure?: never;
}>;

export type RuntimeSpanFailureEvent = RuntimeSpanTerminalCommon & Readonly<{
  outcome: Exclude<RuntimeSpanOutcome, "success">;
  failure: RuntimeFailure;
}>;

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
  | Readonly<{ stateKey: "browser.mutation"; previous: "PREPARED" | "SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN" | null; current: "PREPARED" | "SENT" | "CONFIRMED" | "FAILED" | "UNKNOWN" }>
  | Readonly<{ stateKey: "outbox.delivery"; previous: "pending" | "delivered" | "failed" | null; current: "pending" | "delivered" | "failed" }>;

export type RuntimeStateKey = RuntimeStateDefinition["stateKey"];
export type RuntimeStateValue = RuntimeStateDefinition["current"];

export type RuntimeStateEvent = RuntimeEventCommon & RuntimeStateDefinition & Readonly<{
  type: "STATE";
  freshForMs?: number;
  authorityRef?: string;
  authorityHash?: `sha256:${string}`;
  reconciledFromAuthority?: boolean;
}>;

export type RuntimeLogEventV2 = RuntimeSpanStartedEvent | RuntimeSpanTerminalEvent | RuntimeStateEvent;

export type RuntimeSpanStartInput = Readonly<{
  traceId: string;
  operation: RuntimeOperation;
  typedIdentity: RuntimeTypedIdentity;
  spanId?: string;
  parentSpanId?: string;
  boundaryId?: string;
  owner?: RuntimeLogOwner;
  component?: string;
  visibility?: RuntimeLogVisibility;
}>;

export type RuntimeSuccessfulTerminalInput = Readonly<{
  outcome: "success";
  authorityRef?: string;
  authorityHash?: `sha256:${string}`;
}>;

export type RuntimeFailedTerminalInput = Readonly<{
  outcome: Exclude<RuntimeSpanOutcome, "success">;
  failure: RuntimeFailure;
  authorityRef?: string;
  authorityHash?: `sha256:${string}`;
}>;

export type RuntimeSpanTerminalInput = RuntimeSuccessfulTerminalInput | RuntimeFailedTerminalInput;

export type RuntimeStateInput = Readonly<{
  traceId: string;
  owner?: RuntimeLogOwner;
  component?: string;
  visibility?: RuntimeLogVisibility;
  freshForMs?: number;
  authorityRef?: string;
  authorityHash?: `sha256:${string}`;
  reconciledFromAuthority?: boolean;
}> & RuntimeStateDefinition;

export type WithoutEventHash<T> = T extends unknown ? Omit<T, "eventHash"> : never;
export type RuntimeLogEventWithoutIntegrity = WithoutEventHash<RuntimeLogEventV2>;

export type RuntimeLogWriteFailure = Readonly<{
  ok: false;
  code: "RUNTIME_LOG_CAPACITY_BLOCKED" | "RUNTIME_LOG_SINK_WRITE_FAILED" | "DUPLICATE_SPAN_TERMINAL";
  emergencyProjected: boolean;
}>;

export type RuntimeLogWriteResult<T> =
  | Readonly<{ ok: true; event: T }>
  | RuntimeLogWriteFailure;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const TOKEN_PATTERN = /^[^\s\u0000-\u001f]+$/u;
const OWNER_VALUES = new Set<RuntimeLogOwner>([
  "website", "startup-entrypoint", "app-shell", "production-runtime", "mediator", "product-plugin",
  "gpt", "browser-session", "forensics-persistence", "runtime-logs", "outbox",
]);
const OPERATION_VALUES = new Set<RuntimeOperation>([
  "api.boundary", "browser.command", "browser.infrastructure", "cloud.claim", "cloud.session-open",
  "forensics.append-artifact", "forensics.append-record", "gpt.child", "job.durable-accept", "job.execute",
  "job.checkpoint", "job.lease-release", "job.lease-renew", "job.terminal", "material.download-verify", "mediator.dispatch", "outbox.flush", "plugin.execute",
  "result.upload", "runtime.shutdown", "runtime.start", "website.first-terminal", "website.outbox",
  "startup.step", "website.result-consume", "website.task-create", "website.v6-request",
]);
const STATE_VALUES: Readonly<Record<RuntimeStateKey, ReadonlySet<RuntimeStateValue>>> = {
  "producer.lifecycle": new Set(["starting", "ready", "stopping", "stopped", "exit_detected"]),
  "producer.alive": new Set(["alive"]),
  "log.sink": new Set(["ready", "failed", "capacity_blocked"]),
  "website.core": new Set(["starting", "ready", "failed", "stopped"]),
  "website.worker": new Set(["starting", "ready", "blocked", "failed", "stopped"]),
  "website.consume": new Set(["idle", "pending", "running", "delivered", "failed", "review_required"]),
  "agent.shell": new Set(["starting", "ready", "failed", "stopped"]),
  "cloud.contract": new Set(["ready", "blocked"]),
  "cloud.session": new Set(["disconnected", "connected", "stale"]),
  "claim.admission": new Set(["eligible", "blocked", "draining"]),
  "browser.authority": new Set(["absent", "present", "stale"]),
  "browser.target": new Set(["absent", "claimed", "drifted"]),
  "job.lifecycle": new Set(["accepted", "running", "recovery_pending", "review_required", "completed", "failed"]),
  "job.lease": new Set(["absent", "active", "stale", "lost"]),
  "job.checkpoint": new Set(["none", "persisted", "failed"]),
  "gpt.execution": new Set(["idle", "running", "failed", "review_required"]),
  "browser.execution": new Set(["idle", "busy", "failed", "review_required"]),
  "browser.mutation": new Set(["PREPARED", "SENT", "CONFIRMED", "FAILED", "UNKNOWN"]),
  "outbox.delivery": new Set(["pending", "delivered", "failed"]),
};

const record = (value: unknown): value is Readonly<Record<string, unknown>> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const token = (value: unknown): value is string => typeof value === "string" && TOKEN_PATTERN.test(value);
const machineCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/u.test(value);
const hash = (value: unknown): value is `sha256:${string}` => typeof value === "string" && HASH_PATTERN.test(value);
const isoDate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};
const exactKeys = (value: Readonly<Record<string, unknown>>, required: readonly string[], optional: readonly string[] = []): boolean => {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
};
const authorityPairValid = (value: Readonly<Record<string, unknown>>): boolean =>
  Object.hasOwn(value, "authorityRef") === Object.hasOwn(value, "authorityHash")
  && (!Object.hasOwn(value, "authorityRef") || (token(value.authorityRef) && hash(value.authorityHash)));

const identityValid = (value: unknown): value is RuntimeTypedIdentity => {
  if (!record(value) || !token(value.kind)) return false;
  const shapes: Readonly<Record<string, Readonly<{ required: readonly string[]; optional?: readonly string[]; numbers?: readonly string[] }>>> = {
    producer: { required: ["kind", "producerId"] },
    request: { required: ["kind", "requestId"], optional: ["jobId"] },
    job: { required: ["kind", "jobId"] },
    "job-attempt": { required: ["kind", "jobId", "attemptId"] },
    lease: { required: ["kind", "jobId", "attemptId", "leaseVersion", "fenceHash"], numbers: ["leaseVersion"] },
    "plugin-step": { required: ["kind", "jobId", "attemptId", "pluginId", "stepId"] },
    "gpt-call": { required: ["kind", "jobId", "attemptId", "pluginId", "stepId", "capabilityCallId"] },
    "browser-command": { required: ["kind", "jobId", "attemptId", "leaseVersion", "fenceHash", "pluginId", "commandId"], optional: ["capabilityCallId"], numbers: ["leaseVersion"] },
    "browser-mutation": { required: ["kind", "jobId", "attemptId", "commandId"] },
    checkpoint: { required: ["kind", "jobId", "attemptId", "checkpointId"] },
    outbox: { required: ["kind", "jobId", "outboxId"] },
  };
  const shape = shapes[value.kind];
  if (!shape || !exactKeys(value, shape.required, shape.optional)) return false;
  const numbers = new Set(shape.numbers ?? []);
  return Object.entries(value).every(([key, item]) => key === "kind"
    || (numbers.has(key) ? Number.isInteger(item) && Number(item) >= 0 : token(item)));
};

const failureValid = (value: unknown): value is RuntimeFailure => {
  if (!record(value) || !exactKeys(value,
    ["kind", "code", "responsibleOwner", "impact", "recovery"],
    ["nativeCause", "causedByEventId", "httpStatus"])) return false;
  const impactValid = value.impact === "BLOCKING" || value.impact === "CONSEQUENTIAL" || value.impact === "CLEANUP";
  const causedByValid = value.impact === "BLOCKING" ? !Object.hasOwn(value, "causedByEventId") || token(value.causedByEventId)
    : token(value.causedByEventId);
  return Object.values(RuntimeFailureKind).includes(value.kind as RuntimeFailureKind)
    && machineCode(value.code)
    && token(value.responsibleOwner) && OWNER_VALUES.has(value.responsibleOwner as RuntimeLogOwner)
    && impactValid
    && Object.values(RuntimeRecovery).includes(value.recovery as RuntimeRecovery)
    && (!Object.hasOwn(value, "nativeCause") || machineCode(value.nativeCause))
    && causedByValid
    && (!Object.hasOwn(value, "httpStatus") || (Number.isInteger(value.httpStatus) && Number(value.httpStatus) >= 100 && Number(value.httpStatus) <= 599));
};

const COMMON_KEYS = [
  "schemaVersion", "eventId", "occurredAt", "producer", "producerRunId", "producerSeq",
  "previousEventHash", "eventHash", "type", "traceId", "owner", "component", "visibility",
] as const;

const commonValid = (value: Readonly<Record<string, unknown>>): boolean => value.schemaVersion === 2
  && token(value.eventId)
  && isoDate(value.occurredAt)
  && token(value.producer) && token(value.producerRunId)
  && Number.isInteger(value.producerSeq) && Number(value.producerSeq) > 0
  && (value.previousEventHash === null || hash(value.previousEventHash))
  && hash(value.eventHash)
  && (value.type === "SPAN" || value.type === "STATE")
  && token(value.traceId)
  && token(value.owner) && OWNER_VALUES.has(value.owner as RuntimeLogOwner)
  && token(value.component)
  && (value.visibility === "FLOW" || value.visibility === "DEBUG" || value.visibility === "TRACE");

export const runtimeLogEventShapeValid = (value: unknown): value is RuntimeLogEventV2 => {
  if (!record(value) || !commonValid(value)) return false;
  if (value.type === "STATE") {
    if (!exactKeys(value, [...COMMON_KEYS, "stateKey", "previous", "current"],
      ["freshForMs", "authorityRef", "authorityHash", "reconciledFromAuthority"])) return false;
    if (!token(value.stateKey) || !(value.stateKey in STATE_VALUES)) return false;
    const allowed = STATE_VALUES[value.stateKey as RuntimeStateKey];
    return (value.previous === null || (token(value.previous) && allowed.has(value.previous as RuntimeStateValue)))
      && token(value.current) && allowed.has(value.current as RuntimeStateValue)
      && authorityPairValid(value)
      && (!Object.hasOwn(value, "freshForMs")
        || (value.stateKey === "producer.alive" && Number.isInteger(value.freshForMs) && Number(value.freshForMs) > 0))
      && (!Object.hasOwn(value, "reconciledFromAuthority") || typeof value.reconciledFromAuthority === "boolean")
      && (value.reconciledFromAuthority !== true || Object.hasOwn(value, "authorityRef"));
  }
  if (value.phase === "started") {
    if (!exactKeys(value, [...COMMON_KEYS, "phase", "spanId", "operation", "typedIdentity"], ["parentSpanId", "boundaryId"])) return false;
    return token(value.spanId)
      && token(value.operation) && OPERATION_VALUES.has(value.operation as RuntimeOperation)
      && identityValid(value.typedIdentity)
      && (!Object.hasOwn(value, "parentSpanId") || token(value.parentSpanId))
      && (!Object.hasOwn(value, "boundaryId") || token(value.boundaryId));
  }
  if (value.phase !== "terminal" || !exactKeys(value,
    [...COMMON_KEYS, "phase", "spanId", "operation", "outcome", "durationMs"],
    ["authorityRef", "authorityHash", "failure"])) return false;
  const outcomeValid = value.outcome === "success" || value.outcome === "failed"
    || value.outcome === "review_required" || value.outcome === "skipped";
  return token(value.spanId)
    && token(value.operation) && OPERATION_VALUES.has(value.operation as RuntimeOperation)
    && outcomeValid
    && typeof value.durationMs === "number" && Number.isFinite(value.durationMs) && value.durationMs >= 0
    && authorityPairValid(value)
    && (value.outcome === "success" ? !Object.hasOwn(value, "failure") : failureValid(value.failure));
};

export const assertRuntimeLogEventV2: (value: unknown) => asserts value is RuntimeLogEventV2 = (value) => {
  if (!runtimeLogEventShapeValid(value)) throw new Error("RUNTIME_LOG_EVENT_SCHEMA_INVALID");
};
