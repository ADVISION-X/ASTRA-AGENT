import { RuntimeFailureKind, RuntimeRecovery, type RuntimeFailure, type RuntimeLogOwner, type RuntimeOperation } from "./runtime-failure-contract.js";
import type { RuntimeTypedIdentity } from "./runtime-identity-contract.js";
import type { RuntimeLogEventV2, RuntimeStateKey, RuntimeStateValue } from "./runtime-event-contract.js";

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
  "browser.mutation": new Set(["PREPARED", "DISPATCHED", "CONFIRMED", "REJECTED", "FAILED"]),
  "outbox.delivery": new Set(["pending", "delivered", "failed", "parked"]),
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

const identityEntryValid = (input: Readonly<{
  key: string;
  item: unknown;
  numberKeys: ReadonlySet<string>;
}>): boolean => input.key === "kind"
  || (input.numberKeys.has(input.key)
    ? Number.isInteger(input.item) && Number(input.item) >= 0
    : token(input.item));

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
    "browser-command": {
      required: ["kind", "jobId", "attemptId", "leaseVersion", "fenceHash", "pluginId", "commandId",
        "pluginStepId", "childCapabilityId", "actionOrdinal"],
      optional: ["capabilityCallId"],
      numbers: ["leaseVersion", "actionOrdinal"],
    },
    "browser-mutation": { required: ["kind", "jobId", "attemptId", "commandId"] },
    checkpoint: { required: ["kind", "jobId", "attemptId", "checkpointId"] },
    outbox: { required: ["kind", "jobId", "outboxId"] },
  };
  const shape = shapes[value.kind];
  if (!shape || !exactKeys(value, shape.required, shape.optional)) return false;
  const numbers = new Set(shape.numbers ?? []);
  return Object.entries(value).every(([key, item]) => identityEntryValid({ key, item, numberKeys: numbers }));
};

const failureIdentityValid = (value: Readonly<Record<string, unknown>>): boolean =>
  Object.values(RuntimeFailureKind).includes(value.kind as RuntimeFailureKind)
  && machineCode(value.code)
  && token(value.responsibleOwner)
  && OWNER_VALUES.has(value.responsibleOwner as RuntimeLogOwner)
  && (value.impact === "BLOCKING" || value.impact === "CONSEQUENTIAL" || value.impact === "CLEANUP")
  && Object.values(RuntimeRecovery).includes(value.recovery as RuntimeRecovery);

const failureOptionalFieldsValid = (value: Readonly<Record<string, unknown>>): boolean => {
  const causedByValid = value.impact === "BLOCKING"
    ? !Object.hasOwn(value, "causedByEventId") || token(value.causedByEventId)
    : token(value.causedByEventId);
  return (!Object.hasOwn(value, "nativeCause") || machineCode(value.nativeCause))
    && causedByValid
    && (!Object.hasOwn(value, "httpStatus")
      || (Number.isInteger(value.httpStatus) && Number(value.httpStatus) >= 100 && Number(value.httpStatus) <= 599));
};

const failureValid = (value: unknown): value is RuntimeFailure => {
  if (!record(value) || !exactKeys(value,
    ["kind", "code", "responsibleOwner", "impact", "recovery"],
    ["nativeCause", "causedByEventId", "httpStatus"])) return false;
  return failureIdentityValid(value) && failureOptionalFieldsValid(value);
};

const COMMON_KEYS = [
  "schemaVersion", "eventId", "occurredAt", "producer", "producerRunId", "producerSeq",
  "previousEventHash", "eventHash", "type", "traceId", "owner", "component", "visibility",
] as const;

const producerFieldsValid = (value: Readonly<Record<string, unknown>>): boolean =>
  token(value.producer) && token(value.producerRunId)
  && Number.isInteger(value.producerSeq) && Number(value.producerSeq) > 0
  && (value.previousEventHash === null || hash(value.previousEventHash))
  && hash(value.eventHash);

const ownerFieldsValid = (value: Readonly<Record<string, unknown>>): boolean =>
  token(value.owner) && OWNER_VALUES.has(value.owner as RuntimeLogOwner)
  && token(value.component)
  && (value.visibility === "FLOW" || value.visibility === "DEBUG" || value.visibility === "TRACE");

const commonValid = (value: Readonly<Record<string, unknown>>): boolean => value.schemaVersion === 2
  && token(value.eventId) && isoDate(value.occurredAt)
  && producerFieldsValid(value)
  && (value.type === "SPAN" || value.type === "STATE")
  && token(value.traceId) && ownerFieldsValid(value);

const stateReconciliationValid = (value: Readonly<Record<string, unknown>>): boolean =>
  (!Object.hasOwn(value, "reconciledFromAuthority") || typeof value.reconciledFromAuthority === "boolean")
  && (value.reconciledFromAuthority !== true || Object.hasOwn(value, "authorityRef"));

const stateEventValid = (value: Readonly<Record<string, unknown>>): boolean => {
  if (!exactKeys(value, [...COMMON_KEYS, "stateKey", "previous", "current"],
    ["freshForMs", "authorityRef", "authorityHash", "reconciledFromAuthority"])) return false;
  if (!token(value.stateKey) || !(value.stateKey in STATE_VALUES)) return false;
  const allowed = STATE_VALUES[value.stateKey as RuntimeStateKey];
  const freshnessValid = !Object.hasOwn(value, "freshForMs")
    || (value.stateKey === "producer.alive" && Number.isInteger(value.freshForMs) && Number(value.freshForMs) > 0);
  return (value.previous === null || (token(value.previous) && allowed.has(value.previous as RuntimeStateValue)))
    && token(value.current) && allowed.has(value.current as RuntimeStateValue)
    && authorityPairValid(value) && freshnessValid
    && stateReconciliationValid(value);
};

const startedSpanValid = (value: Readonly<Record<string, unknown>>): boolean => {
  if (!exactKeys(value, [...COMMON_KEYS, "phase", "spanId", "operation", "typedIdentity"],
    ["parentSpanId", "boundaryId"])) return false;
  return token(value.spanId)
    && token(value.operation) && OPERATION_VALUES.has(value.operation as RuntimeOperation)
    && identityValid(value.typedIdentity)
    && (!Object.hasOwn(value, "parentSpanId") || token(value.parentSpanId))
    && (!Object.hasOwn(value, "boundaryId") || token(value.boundaryId));
};

const terminalSpanValid = (value: Readonly<Record<string, unknown>>): boolean => {
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

export const runtimeLogEventShapeValid = (value: unknown): value is RuntimeLogEventV2 => {
  if (!record(value) || !commonValid(value)) return false;
  if (value.type === "STATE") return stateEventValid(value);
  return value.phase === "started" ? startedSpanValid(value) : terminalSpanValid(value);
};

export const assertRuntimeLogEventV2: (value: unknown) => asserts value is RuntimeLogEventV2 = (value) => {
  if (!runtimeLogEventShapeValid(value)) throw new Error("RUNTIME_LOG_EVENT_SCHEMA_INVALID");
};
