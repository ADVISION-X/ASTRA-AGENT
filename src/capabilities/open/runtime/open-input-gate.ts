import { createHash } from "node:crypto";

import { OpenRequestSchema } from "../schema.js";

const VALID_CHILD_ID_VALUES = ["open-tiktok", "open-facebook", "open-local-workbench"] as const;
const VALID_PLATFORM_ID_VALUES = ["tiktok-web", "facebook-web", "local-workbench"] as const;
const VALID_TARGET_KIND_VALUES = ["platform-feed", "local-workbench"] as const;

const VALID_CHILD_IDS = new Set<(typeof VALID_CHILD_ID_VALUES)[number]>(VALID_CHILD_ID_VALUES);
const VALID_PLATFORM_IDS = new Set<(typeof VALID_PLATFORM_ID_VALUES)[number]>(VALID_PLATFORM_ID_VALUES);
const VALID_TARGET_KINDS = new Set<(typeof VALID_TARGET_KIND_VALUES)[number]>(VALID_TARGET_KIND_VALUES);

type OpenTraceValue<TValue extends string> = {
  value: TValue | null;
  source: "provided" | "unavailable";
};

export type OpenDispatchFailureTrace = {
  childCapabilityId: OpenTraceValue<"open-tiktok" | "open-facebook" | "open-local-workbench">;
  platformId: OpenTraceValue<"tiktok-web" | "facebook-web" | "local-workbench">;
  targetKind: OpenTraceValue<"platform-feed" | "local-workbench">;
  missionId: OpenTraceValue<string>;
  runId: OpenTraceValue<string>;
  sessionId: OpenTraceValue<string>;
  stepId: OpenTraceValue<string>;
  mapPackageId: OpenTraceValue<string>;
  mapPackageVersion: OpenTraceValue<string>;
  selectedMapId: OpenTraceValue<string>;
  selectedMapVersion: OpenTraceValue<string>;
  activationSnapshotRef: OpenTraceValue<string>;
  capabilityCallId: OpenTraceValue<string>;
  nerveBusEnvelopeId: OpenTraceValue<string>;
  targetUrl: OpenTraceValue<string>;
  roundId: string | null;
  videoVisitId: string | null;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string | null;
  targetTitle: string | null;
  inputRef: OpenTraceValue<string>;
  idempotencyKey: OpenTraceValue<string>;
  timeoutMs: number | null;
  receivedShapeHash: string;
  sourceRef: string | null;
  requestedBy: string;
  parseDecision: "parsed" | "fallback_trace_only";
};

function readObjectValue(input: unknown, key: string): unknown {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }
  return (input as Record<string, unknown>)[key];
}

function readOptionalString(input: unknown, key: string): string | null {
  const current = readObjectValue(input, key);
  return typeof current === "string" && current.trim().length > 0 ? current : null;
}

function readPositiveInt(input: unknown, key: string): number | null {
  const current = readObjectValue(input, key);
  return typeof current === "number" && Number.isInteger(current) && current > 0
    ? current
    : null;
}

function readTraceString(input: unknown, key: string): OpenTraceValue<string> {
  const value = readOptionalString(input, key);
  return {
    value,
    source: value ? "provided" : "unavailable",
  };
}

function hashInputShape(input: unknown): string {
  const serialized = (() => {
    try {
      return JSON.stringify(input, (_key, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      }) ?? String(input);
    } catch {
      return String(input);
    }
  })();

  return createHash("sha256").update(serialized).digest("hex");
}

function readValidatedString<TValue extends string>(input: unknown, key: string, allowed: Set<TValue>): OpenTraceValue<TValue> {
  const current = readOptionalString(input, key);
  if (current && allowed.has(current as TValue)) {
    return { value: current as TValue, source: "provided" };
  }
  return { value: null, source: "unavailable" };
}

export function parseOpenAbilityInput(input: unknown) {
  return OpenRequestSchema.safeParse(input);
}

export function extractOpenFailureTrace(input: unknown): OpenDispatchFailureTrace {
  return {
    childCapabilityId: readValidatedString<"open-tiktok" | "open-facebook" | "open-local-workbench">(input, "childCapabilityId", VALID_CHILD_IDS),
    platformId: readValidatedString<"tiktok-web" | "facebook-web" | "local-workbench">(input, "platformId", VALID_PLATFORM_IDS),
    targetKind: readValidatedString<"platform-feed" | "local-workbench">(input, "targetKind", VALID_TARGET_KINDS),
    missionId: readTraceString(input, "missionId"),
    runId: readTraceString(input, "runId"),
    sessionId: readTraceString(input, "sessionId"),
    stepId: readTraceString(input, "stepId"),
    mapPackageId: readTraceString(input, "mapPackageId"),
    mapPackageVersion: readTraceString(input, "mapPackageVersion"),
    selectedMapId: readTraceString(input, "selectedMapId"),
    selectedMapVersion: readTraceString(input, "selectedMapVersion"),
    activationSnapshotRef: readTraceString(input, "activationSnapshotRef"),
    capabilityCallId: readTraceString(input, "capabilityCallId"),
    nerveBusEnvelopeId: readTraceString(input, "nerveBusEnvelopeId"),
    targetUrl: readTraceString(input, "targetUrl"),
    roundId: readOptionalString(input, "roundId"),
    videoVisitId: readOptionalString(input, "videoVisitId"),
    targetTitle: readOptionalString(input, "targetTitle"),
    sourceAbilityGroupId: readOptionalString(input, "sourceAbilityGroupId") ?? "orchestration",
    sourceChildCapabilityId: readOptionalString(input, "sourceChildCapabilityId"),
    inputRef: readTraceString(input, "inputRef"),
    idempotencyKey: readTraceString(input, "idempotencyKey"),
    timeoutMs: readPositiveInt(input, "timeoutMs"),
    receivedShapeHash: hashInputShape(input),
    sourceRef: readOptionalString(input, "sourceRef"),
    requestedBy: readOptionalString(input, "requestedBy") ?? "orchestration",
    parseDecision: "fallback_trace_only",
  };
}