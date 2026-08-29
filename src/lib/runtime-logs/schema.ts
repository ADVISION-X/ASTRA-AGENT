import { RuntimeFailureKind, type RuntimeFailure, type RuntimeLogOwner, type RuntimeOperation } from "./runtime-failure-contract.js";
import type { RuntimeTypedIdentity } from "./runtime-identity-contract.js";
import type { RuntimeLogEventV2 } from "./runtime-event-contract.js";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const TOKEN_PATTERN = /^[^\s\u0000-\u001f]+$/u;
const MACHINE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/u;
const OWNER_VALUES = new Set<RuntimeLogOwner>([
  "website", "startup-entrypoint", "app-shell", "production-runtime", "mediator", "product-plugin",
  "gpt", "browser-session", "forensics-persistence", "runtime-logs", "outbox",
]);
const OPERATION_VALUES = new Set<RuntimeOperation>([
  "api.boundary", "browser.command", "browser.infrastructure", "cloud.claim", "cloud.session-open",
  "forensics.append-artifact", "forensics.append-record", "gpt.child", "job.durable-accept", "job.execute",
  "job.checkpoint", "job.lease-release", "job.lease-renew", "job.terminal", "material.download-verify",
  "mediator.dispatch", "outbox.flush", "plugin.execute", "result.upload", "runtime.shutdown", "runtime.start",
  "website.first-terminal", "website.outbox", "website.result-consume", "website.task-create", "website.v6-request",
  "startup.step",
]);

const record = (value: unknown): value is Readonly<Record<string, unknown>> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const token = (value: unknown): value is string => typeof value === "string" && TOKEN_PATTERN.test(value);
const machineCode = (value: unknown): value is string => typeof value === "string" && MACHINE_CODE_PATTERN.test(value);
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
const referencePairsValid = (value: Readonly<Record<string, unknown>>): boolean => {
  for (const [ref, digest] of [["authorityRef", "authorityHash"], ["evidenceRef", "evidenceHash"]] as const) {
    if (Object.hasOwn(value, ref) !== Object.hasOwn(value, digest)) return false;
    if (Object.hasOwn(value, ref) && (!token(value[ref]) || !hash(value[digest]))) return false;
  }
  return true;
};

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
  const shapes: Readonly<Record<string, Readonly<{
    required: readonly string[];
    optional?: readonly string[];
    numbers?: readonly string[];
  }>>> = {
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

const failureValid = (value: unknown): value is RuntimeFailure => {
  if (!record(value) || !exactKeys(value,
    ["kind", "code", "responsibleOwner", "impact"],
    ["nativeCause", "causedByEventId", "httpStatus"])) return false;
  const causedByValid = value.impact === "BLOCKING"
    ? !Object.hasOwn(value, "causedByEventId") || token(value.causedByEventId)
    : token(value.causedByEventId);
  return Object.values(RuntimeFailureKind).includes(value.kind as RuntimeFailure["kind"])
    && machineCode(value.code)
    && token(value.responsibleOwner)
    && OWNER_VALUES.has(value.responsibleOwner as RuntimeLogOwner)
    && (value.impact === "BLOCKING" || value.impact === "CONSEQUENTIAL" || value.impact === "CLEANUP")
    && (!Object.hasOwn(value, "nativeCause") || machineCode(value.nativeCause))
    && causedByValid
    && (!Object.hasOwn(value, "httpStatus")
      || (Number.isInteger(value.httpStatus) && Number(value.httpStatus) >= 100 && Number(value.httpStatus) <= 599));
};

const COMMON_KEYS = [
  "schemaVersion", "eventId", "emittedAt", "producer", "producerRunId", "producerSeq",
  "previousEventHash", "eventHash", "kind", "traceId", "owner", "component", "operation", "visibility",
] as const;
const REFERENCE_KEYS = ["authorityRef", "authorityHash", "evidenceRef", "evidenceHash"] as const;

const commonValid = (value: Readonly<Record<string, unknown>>): boolean => value.schemaVersion === 2
  && token(value.eventId) && isoDate(value.emittedAt)
  && token(value.producer) && token(value.producerRunId)
  && Number.isInteger(value.producerSeq) && Number(value.producerSeq) > 0
  && (value.previousEventHash === null || hash(value.previousEventHash))
  && hash(value.eventHash)
  && (value.kind === "event" || value.kind === "span.started" || value.kind === "span.terminal" || value.kind === "error")
  && token(value.traceId)
  && token(value.owner) && OWNER_VALUES.has(value.owner as RuntimeLogOwner)
  && token(value.component)
  && token(value.operation) && OPERATION_VALUES.has(value.operation as RuntimeOperation)
  && (value.visibility === "FLOW" || value.visibility === "DEBUG" || value.visibility === "TRACE");

const observedEventValid = (value: Readonly<Record<string, unknown>>): boolean =>
  exactKeys(value, [...COMMON_KEYS, "code", "typedIdentity"], REFERENCE_KEYS)
  && machineCode(value.code) && identityValid(value.typedIdentity) && referencePairsValid(value);

const errorEventValid = (value: Readonly<Record<string, unknown>>): boolean =>
  exactKeys(value, [...COMMON_KEYS, "failure", "typedIdentity"], REFERENCE_KEYS)
  && failureValid(value.failure) && identityValid(value.typedIdentity) && referencePairsValid(value);

const startedSpanValid = (value: Readonly<Record<string, unknown>>): boolean =>
  exactKeys(value, [...COMMON_KEYS, "spanId", "typedIdentity"], ["parentSpanId", "boundaryId"])
  && token(value.spanId) && identityValid(value.typedIdentity)
  && (!Object.hasOwn(value, "parentSpanId") || token(value.parentSpanId))
  && (!Object.hasOwn(value, "boundaryId") || token(value.boundaryId));

const terminalSpanValid = (value: Readonly<Record<string, unknown>>): boolean => {
  if (!exactKeys(value,
    [...COMMON_KEYS, "spanId", "outcome", "durationMs"],
    [...REFERENCE_KEYS, "failure"])) return false;
  const outcomeValid = value.outcome === "succeeded" || value.outcome === "failed" || value.outcome === "interrupted";
  return token(value.spanId)
    && outcomeValid
    && typeof value.durationMs === "number" && Number.isFinite(value.durationMs) && value.durationMs >= 0
    && referencePairsValid(value)
    && (value.outcome === "succeeded" ? !Object.hasOwn(value, "failure") : failureValid(value.failure));
};

export const runtimeLogEventShapeValid = (value: unknown): value is RuntimeLogEventV2 => {
  if (!record(value) || !commonValid(value)) return false;
  if (value.kind === "event") return observedEventValid(value);
  if (value.kind === "error") return errorEventValid(value);
  if (value.kind === "span.started") return startedSpanValid(value);
  return terminalSpanValid(value);
};

export const assertRuntimeLogEventV2: (value: unknown) => asserts value is RuntimeLogEventV2 = (value) => {
  if (!runtimeLogEventShapeValid(value)) throw new Error("RUNTIME_LOG_EVENT_SCHEMA_INVALID");
};
